import { Router, type Request, type Response } from 'express';
import { routeMessage } from '../lib/rafeeq/router.ts';
import { loadSession, saveTurn } from '../lib/rafeeq/session.ts';

const router = Router();

async function sendWhatsAppText(to: string, body: string): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_TOKEN;

  if (!phoneNumberId || !token) {
    const msg =
      'DEBUG ERROR: WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_TOKEN is not set on the server.';
    console.log(msg);
    await sendDebugMessage(to, msg, phoneNumberId, token);
    return;
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body },
        }),
      },
    );

    if (!response.ok) {
      const errText = await response.text();
      console.log(`WhatsApp send failed (${response.status}):`, errText);
      await sendDebugMessage(
        to,
        `DEBUG ERROR: send failed (${response.status}): ${errText}`,
        phoneNumberId,
        token,
      );
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.log('WhatsApp send error:', error);
    // If fetch itself is missing (old Node runtime) this catch is what
    // fires — surface it below via a raw HTTPS fallback so we can see it
    // even without server log access.
    await sendDebugMessage(
      to,
      `DEBUG ERROR: exception during send: ${errMsg}`,
      phoneNumberId,
      token,
    );
  }
}

/**
 * Last-resort error reporter — uses Node's built-in https module (not fetch)
 * so it still works even if the bug turns out to be "fetch doesn't exist"
 * on the deployed runtime. TEMPORARY: remove this whole function + its
 * call sites once the real bug is found and fixed, since sending raw
 * error text back to a chat isn't something you want in production.
 */
async function sendDebugMessage(
  to: string,
  debugText: string,
  phoneNumberId: string | undefined,
  token: string | undefined,
): Promise<void> {
  if (!phoneNumberId || !token) {
    console.log('Cannot send debug message either — no phoneNumberId/token.');
    return;
  }
  try {
    const https = await import('node:https');
    const payload = JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: debugText.slice(0, 1000) },
    });

    await new Promise<void>((resolve) => {
      const req = https.request(
        {
          hostname: 'graph.facebook.com',
          path: `/v21.0/${phoneNumberId}/messages`,
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          },
        },
        (res) => {
          res.on('data', () => {});
          res.on('end', resolve);
        },
      );
      req.on('error', (e) => {
        console.log('Debug message send also failed:', e);
        resolve();
      });
      req.write(payload);
      req.end();
    });
  } catch (e) {
    console.log('Could not send debug message:', e);
  }
}

// Meta calls this once to verify we control the endpoint.
router.get('/api/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    res.status(200).send(challenge);
    return;
  }
  res.sendStatus(403);
});

// Every incoming WhatsApp Cloud API event lands here.
router.post('/api/webhook', (req: Request, res: Response) => {
  const value = req.body?.entry?.[0]?.changes?.[0]?.value;
  const message = value?.messages?.[0];

  // Always 200 immediately so Meta doesn't retry the webhook.
  res.status(200).json({ ok: true });

  // Delivery/read status callbacks arrive with no `messages` field.
  if (!message) {
    return;
  }

  console.log('Incoming WhatsApp message:', JSON.stringify(message, null, 2));

  const text: string | undefined = message.text?.body;
  const from: string | undefined = message.from;

  // Non-text messages (media, locations, button taps) aren't routed yet.
  if (from && text) {
    handleIncomingText(from, text).catch((error) => {
      console.log('Failed to handle incoming message:', error);
    });
  }
});

async function handleIncomingText(from: string, text: string): Promise<void> {
  const session = await loadSession(from);

  const routed = await routeMessage({
    msisdn: from,
    lang: session.lang,
    stage: session.stage,
    activeService: session.activeService,
    history: session.history,
    latestMessage: text,
  });

  const activeService =
    routed.intent === 'start_service' && routed.serviceId
      ? routed.serviceId
      : session.activeService;

  // Reply first (latency), persist after — a failed save loses one turn of
  // context but never the user's reply.
  await sendWhatsAppText(from, routed.replyText);
  await saveTurn(session, text, routed.replyText, activeService);
}

export default router;
