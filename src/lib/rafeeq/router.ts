import Groq from 'groq-sdk';
import { z } from 'zod';
import { SERVICES, flowFor } from './config.ts';
import { buildSystemPrompt } from './system-prompt.ts';

// Lazy: app.ts loads .env in its module body, which runs AFTER imports are
// evaluated — constructing the client at import time would read the env too
// early and miss GROQ_API_KEY locally. The SDK reads GROQ_API_KEY itself.
let groq: Groq | undefined;
function getClient(): Groq {
  groq ??= new Groq();
  return groq;
}

const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

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
  service_id: z.string().nullish(),
  extracted_fields: z
    .record(z.string(), z.unknown())
    .nullish()
    .transform((v) => v ?? {}),
  reply_text: z.string().min(1),
});

// One tool call does three jobs at once: classify intent, pull out any
// structured data mentioned in passing (weight, destination, dates...),
// and draft the reply — so we don't pay for three round trips.
const ROUTING_TOOL: Groq.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'route_message',
    description: "Classify the user's WhatsApp message and draft a reply.",
    parameters: {
      type: 'object',
      properties: {
        intent: {
          type: 'string',
          enum: [...INTENTS],
        },
        service_id: {
          // The model often emits an explicit null when there's no service —
          // Groq validates tool args server-side, so the schema must allow it.
          type: ['string', 'null'],
          description: `One of: ${SERVICES.map((s) => s.id).join(', ')}. Null unless intent is start_service.`,
        },
        extracted_fields: {
          type: ['object', 'null'],
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

  const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: system },
    ...input.history.map(
      (h): Groq.Chat.Completions.ChatCompletionMessageParam => ({
        role: h.role === 'user' ? 'user' : 'assistant',
        content: h.content,
      }),
    ),
    { role: 'user', content: input.latestMessage },
  ];

  let completion: Groq.Chat.Completions.ChatCompletion;
  try {
    completion = await getClient().chat.completions.create({
      model: process.env.GROQ_MODEL ?? DEFAULT_MODEL,
      messages,
      tools: [ROUTING_TOOL],
      tool_choice: { type: 'function', function: { name: 'route_message' } },
      // Routing should be consistent, not creative.
      temperature: 0.3,
      max_completion_tokens: 1024,
    });
  } catch (error) {
    if (error instanceof Groq.RateLimitError) {
      console.log('Groq rate limited:', error.message);
    } else if (error instanceof Groq.APIError) {
      console.log(`Groq API error ${error.status}:`, error.message);
    } else {
      console.log('Groq request failed:', error);
    }
    return fallback(OUTAGE_REPLY);
  }

  const toolCall = completion.choices[0]?.message?.tool_calls?.[0];
  if (!toolCall) {
    // Should be rare with tool_choice forced, but don't crash the webhook over it.
    return fallback(FALLBACK_REPLY);
  }

  let rawArgs: unknown;
  try {
    rawArgs = JSON.parse(toolCall.function.arguments);
  } catch {
    console.log('route_message arguments were not valid JSON:', toolCall.function.arguments);
    return fallback(FALLBACK_REPLY);
  }

  const parsed = RoutedOutputSchema.safeParse(rawArgs);
  if (!parsed.success) {
    console.log('route_message output failed validation:', parsed.error.message);
    return fallback(FALLBACK_REPLY);
  }

  const out = parsed.data;
  // Only accept service IDs from the catalog — a hallucinated ID would
  // otherwise flow into the form/session layer.
  const serviceId =
    out.service_id != null && SERVICES.some((s) => s.id === out.service_id)
      ? out.service_id
      : undefined;

  // Enforce the field-ID contract deterministically: only keep keys that the
  // relevant service's form actually defines — the model sometimes invents
  // extra keys despite the prompt.
  const targetService = serviceId ?? input.activeService;
  let extractedFields: Record<string, unknown> = {};
  if (targetService) {
    const validIds = new Set(
      flowFor(targetService).screens.flatMap((s) => s.fields.map((f) => f.id)),
    );
    extractedFields = Object.fromEntries(
      Object.entries(out.extracted_fields).filter(
        ([key, value]) => validIds.has(key) && value != null && value !== '',
      ),
    );
  }

  return {
    intent: out.intent,
    serviceId,
    extractedFields,
    replyText: out.reply_text,
  };
}
