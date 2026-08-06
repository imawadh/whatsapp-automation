import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { SERVICES } from './config.ts';
import { buildSystemPrompt } from './system-prompt.ts';

// No explicit apiKey: the SDK resolves ANTHROPIC_API_KEY from the environment
// and fails loudly at construction/request time instead of silently carrying
// an undefined key.
const anthropic = new Anthropic();

const INTENTS = [
  'start_service',
  'continue_flow',
  'ask_status',
  'smalltalk',
  'human_handoff',
  'unclear',
] as const;

export interface RoutedMessage {
  intent: (typeof INTENTS)[number];
  serviceId?: string;
  extractedFields: Record<string, unknown>;
  replyText: string;
}

export interface RouteInput {
  msisdn: string;
  lang: string;
  stage: string;
  activeService?: string;
  history: { role: string; content: string }[];
  latestMessage: string;
}

// The model is told to fill this tool on every turn; validate its output
// before letting it drive routing decisions.
const RoutedOutputSchema = z.object({
  intent: z.enum(INTENTS),
  service_id: z.string().optional(),
  extracted_fields: z.record(z.string(), z.unknown()).default({}),
  reply_text: z.string().min(1),
});

// One tool call does three jobs at once: classify intent, pull out any
// structured data mentioned in passing (weight, destination, dates...),
// and draft the reply — so we don't pay for three round trips.
const ROUTING_TOOL: Anthropic.Tool = {
  name: 'route_message',
  description: "Classify the user's WhatsApp message and draft a reply.",
  input_schema: {
    type: 'object',
    properties: {
      intent: {
        type: 'string',
        enum: [...INTENTS],
      },
      service_id: {
        type: 'string',
        description: `One of: ${SERVICES.map((s) => s.id).join(', ')}. Only if intent is start_service.`,
      },
      extracted_fields: {
        type: 'object',
        description:
          'Any structured details the user volunteered (e.g. weight, destination, date). Empty object if none.',
      },
      reply_text: {
        type: 'string',
        description:
          'The reply to send back to the user, written in their language, WhatsApp-length (short).',
      },
    },
    required: ['intent', 'extracted_fields', 'reply_text'],
  },
};

const FALLBACK_REPLY = 'Sorry, could you rephrase that?';
const OUTAGE_REPLY =
  'Sorry, we are having a technical problem right now. Please try again in a few minutes.';

function fallback(replyText: string): RoutedMessage {
  return { intent: 'unclear', extractedFields: {}, replyText };
}

export async function routeMessage(input: RouteInput): Promise<RoutedMessage> {
  const system = buildSystemPrompt({
    lang: input.lang,
    stage: input.stage,
    activeService: input.activeService,
  });

  // The Messages API requires the first message to be a user turn; stored
  // history may open with an assistant greeting/menu, so drop leading
  // assistant turns.
  const history = [...input.history];
  while (history.length > 0 && history[0].role !== 'user') {
    history.shift();
  }

  const messages: Anthropic.MessageParam[] = [
    ...history.map(
      (h): Anthropic.MessageParam => ({
        role: h.role === 'user' ? 'user' : 'assistant',
        content: h.content,
      }),
    ),
    { role: 'user', content: input.latestMessage },
  ];

  let response: Anthropic.Message;
  try {
    response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      system,
      messages,
      tools: [ROUTING_TOOL],
      tool_choice: { type: 'tool', name: 'route_message' },
    });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      console.log('Anthropic rate limited:', error.message);
    } else if (error instanceof Anthropic.APIError) {
      console.log(`Anthropic API error ${error.status}:`, error.message);
    } else {
      console.log('Anthropic request failed:', error);
    }
    return fallback(OUTAGE_REPLY);
  }

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
  );
  if (!toolUse) {
    // Should be rare with tool_choice forced, but don't crash the webhook over it.
    return fallback(FALLBACK_REPLY);
  }

  const parsed = RoutedOutputSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    console.log('route_message output failed validation:', parsed.error.message);
    return fallback(FALLBACK_REPLY);
  }

  const out = parsed.data;
  // Only accept service IDs from the catalog — a hallucinated ID would
  // otherwise flow into the form/session layer.
  const serviceId = SERVICES.some((s) => s.id === out.service_id)
    ? out.service_id
    : undefined;

  return {
    intent: out.intent,
    serviceId,
    extractedFields: out.extracted_fields,
    replyText: out.reply_text,
  };
}
