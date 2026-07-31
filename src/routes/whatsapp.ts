import { Router, type Request, type Response } from 'express';

const router = Router();

async function sendWhatsAppText(to: string, body: string): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_TOKEN;

  if (!phoneNumberId || !token) {
    console.log(
      'WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_TOKEN is not set; skipping reply.',
    );
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
      console.log(
        `WhatsApp send failed (${response.status}):`,
        await response.text(),
      );
    }
  } catch (error) {
    console.log('WhatsApp send error:', error);
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
  const normalized = text?.trim().toLowerCase();

  if (from && (normalized === 'hi' || normalized === 'hello')) {
    void sendWhatsAppText(from, "Hello! 👋 I'm your WhatsApp bot, working.");
  }
});

export default router;
