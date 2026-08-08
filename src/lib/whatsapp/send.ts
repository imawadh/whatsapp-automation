// Every outbound WhatsApp Cloud API call goes through here — nothing else in
// the codebase should call fetch() against graph.facebook.com directly.

const WA_API_VERSION = 'v21.0';

// Read env lazily, not at module load: app.ts calls process.loadEnvFile('.env')
// in its module body, which runs AFTER imports are evaluated, so a top-level
// read would capture an empty value locally.
function credentials(): { phoneNumberId: string; token: string } {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_TOKEN;
  if (!phoneNumberId || !token) {
    throw new Error(
      'WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_TOKEN is not set on the server',
    );
  }
  return { phoneNumberId, token };
}

async function callWA(body: Record<string, unknown>): Promise<unknown> {
  const { phoneNumberId, token } = credentials();

  const response = await fetch(
    `https://graph.facebook.com/${WA_API_VERSION}/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messaging_product: 'whatsapp', ...body }),
    },
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`WhatsApp send failed (${response.status}): ${errText}`);
  }
  return response.json();
}

export function sendText(to: string, text: string): Promise<unknown> {
  return callWA({
    to,
    type: 'text',
    text: { body: text, preview_url: false },
  });
}

export interface ListRow {
  id: string;
  title: string;
  description?: string;
}

export interface ListSection {
  title: string;
  rows: ListRow[];
}

// Interactive list — used for the language picker and the service menu.
export function sendList(
  to: string,
  bodyText: string,
  buttonText: string,
  sections: ListSection[],
): Promise<unknown> {
  return callWA({
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: bodyText },
      action: { button: buttonText, sections },
    },
  });
}

export function sendButtons(
  to: string,
  bodyText: string,
  buttons: { id: string; title: string }[],
): Promise<unknown> {
  return callWA({
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: bodyText },
      action: { buttons: buttons.map((b) => ({ type: 'reply', reply: b })) },
    },
  });
}

// Opens a WhatsApp Flow (the actual form sheet). flowId comes from the Meta
// Flows dashboard once each service's screens are published there — nothing
// calls this yet because no Flow has been published.
export function sendFlow(
  to: string,
  bodyText: string,
  flowId: string,
  flowToken: string,
  screenId: string,
  flowCta: string,
): Promise<unknown> {
  return callWA({
    to,
    type: 'interactive',
    interactive: {
      type: 'flow',
      body: { text: bodyText },
      action: {
        name: 'flow',
        parameters: {
          flow_message_version: '3',
          flow_token: flowToken,
          flow_id: flowId,
          flow_cta: flowCta,
          flow_action: 'navigate',
          flow_action_payload: { screen: screenId },
        },
      },
    },
  });
}

export function sendTemplate(
  to: string,
  name: string,
  lang: string,
  components?: unknown[],
): Promise<unknown> {
  return callWA({
    to,
    type: 'template',
    template: { name, language: { code: lang }, components },
  });
}
