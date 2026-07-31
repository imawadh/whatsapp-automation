import { Router, type Request, type Response } from 'express';

const router = Router();

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

  // Delivery/read status callbacks arrive with no `messages` field.
  if (message) {
    console.log('Incoming WhatsApp message:', JSON.stringify(message, null, 2));
    // TODO: session lookup, flow engine, reply logic goes here.
  }

  // Always 200 so Meta doesn't retry the webhook.
  res.status(200).json({ ok: true });
});

export default router;
