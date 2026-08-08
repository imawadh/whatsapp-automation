import { Router, type Request, type Response } from 'express';
import { routeMessage } from '../lib/rafeeq/router.ts';
import {
  loadSession,
  saveTurn,
  setLang,
  type SessionContext,
} from '../lib/rafeeq/session.ts';
import {
  LANG_PREFIX,
  PAGE_PREFIX,
  SERVICE_PREFIX,
  sendLanguagePicker,
  sendServiceMenu,
} from '../lib/rafeeq/menus.ts';
import {
  SERVICES,
  isLangKeyword,
  isMenuKeyword,
  isSupportedLang,
  serviceLabel,
  ui,
} from '../lib/rafeeq/config.ts';
import { sendText } from '../lib/whatsapp/send.ts';

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

  // Always 200 immediately so Meta doesn't retry the webhook.
  res.status(200).json({ ok: true });

  // Delivery/read status callbacks arrive with no `messages` field.
  if (!message) {
    return;
  }

  console.log('Incoming WhatsApp message:', JSON.stringify(message, null, 2));

  const from: string | undefined = message.from;
  if (!from) {
    return;
  }

  handleMessage(from, message).catch((error) => {
    console.log('Failed to handle incoming message:', error);
  });
});

async function handleMessage(from: string, message: unknown): Promise<void> {
  const session = await loadSession(from);

  // Taps on a list row or reply button — both carry the id we set when
  // building the menu (see menus.ts).
  const interactive = (message as { interactive?: Record<string, unknown> })
    .interactive;
  const selectionId =
    (interactive?.list_reply as { id?: string } | undefined)?.id ??
    (interactive?.button_reply as { id?: string } | undefined)?.id;

  if (selectionId) {
    await handleSelection(from, session, selectionId);
    return;
  }

  const text = (message as { text?: { body?: string } }).text?.body;
  // Media, locations and other non-text messages aren't routed yet.
  if (!text) {
    return;
  }

  // Onboarding: nothing gets routed to the model until we know what language
  // to answer in.
  if (!session.hasLang) {
    await sendLanguagePicker(from);
    return;
  }

  // An interactive list is spent once a row is picked, so these keywords are
  // the only way back to a usable menu. Treated as navigation, like paging —
  // not recorded as a conversation turn.
  if (isLangKeyword(text)) {
    await sendLanguagePicker(from);
    return;
  }
  if (isMenuKeyword(text)) {
    await sendServiceMenu(from, session.lang);
    return;
  }

  await handleIncomingText(from, session, text);
}

async function handleSelection(
  from: string,
  session: SessionContext,
  selectionId: string,
): Promise<void> {
  if (selectionId.startsWith(LANG_PREFIX)) {
    const lang = selectionId.slice(LANG_PREFIX.length);
    if (!isSupportedLang(lang)) {
      await sendLanguagePicker(from);
      return;
    }

    await setLang(session.userId, lang);
    // One message, not two: the acknowledgement rides in the list's body so
    // the service menu can't get separated from it in the chat.
    const ack = ui(lang, 'langSet');
    await sendServiceMenu(from, lang, { ack });
    await saveTurn(
      session,
      `[selected language: ${lang}]`,
      `${ack}\n\n${ui(lang, 'menuPrompt')}`,
      session.activeService,
    );
    return;
  }

  if (selectionId.startsWith(PAGE_PREFIX)) {
    // Pure navigation within the menu — nothing worth recording as a turn.
    const page = Number.parseInt(selectionId.slice(PAGE_PREFIX.length), 10);
    await sendServiceMenu(from, session.lang, {
      page: Number.isNaN(page) ? 0 : page,
    });
    return;
  }

  if (selectionId.startsWith(SERVICE_PREFIX)) {
    const serviceId = selectionId.slice(SERVICE_PREFIX.length);
    if (!SERVICES.some((s) => s.id === serviceId)) {
      await sendServiceMenu(from, session.lang);
      return;
    }
    await startService(from, session, serviceId);
    return;
  }

  console.log(`Unrecognised interactive selection id: ${selectionId}`);
}

/**
 * Picking a service from the menu only opens the conversation for it — it does
 * not create a request. Recording the choice as a `[selected: ...]` turn is what
 * carries it into the model's history, and saveTurn sets it as the active
 * service so following messages route as continue_flow.
 */
async function startService(
  from: string,
  session: SessionContext,
  serviceId: string,
): Promise<void> {
  const reply = `${ui(session.lang, 'serviceSelected', {
    service: serviceLabel(session.lang, serviceId),
  })}\n\n${ui(session.lang, 'menuHint')}`;

  await sendText(from, reply);
  await saveTurn(session, `[selected: ${serviceId}]`, reply, serviceId);
}

async function handleIncomingText(
  from: string,
  session: SessionContext,
  text: string,
): Promise<void> {
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
  await sendText(from, routed.replyText);
  await saveTurn(session, text, routed.replyText, activeService);
}

export default router;
