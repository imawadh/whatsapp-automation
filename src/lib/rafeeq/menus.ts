// Builds and sends the deterministic interactive menus (language picker,
// service menu). Row IDs defined here are the contract the webhook parses
// incoming interactive replies against.

import { LANGS, SERVICES, serviceLabel, ui } from './config.ts';
import { sendList, type ListRow } from '../whatsapp/send.ts';

// WhatsApp Cloud API caps an interactive list at 10 rows across all sections,
// and truncating server-side is a 400 rather than a silent trim.
const MAX_ROWS = 10;
const MAX_ROW_TITLE = 24;
const MAX_ROW_DESCRIPTION = 72;
const MAX_BUTTON_TEXT = 20;

export const LANG_PREFIX = 'lang:';
export const SERVICE_PREFIX = 'svc:';
export const PAGE_PREFIX = 'page:';

function clamp(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/**
 * Splits the service catalog into pages that fit MAX_ROWS. Two rows are held
 * back so any page has room for both nav rows ("More services" and "Back")
 * without a page ever exceeding the cap. With 12 services this yields [8, 4].
 */
function servicePages(): string[][] {
  const ids = SERVICES.map((s) => s.id);
  if (ids.length <= MAX_ROWS) {
    return [ids];
  }
  const perPage = MAX_ROWS - 2;
  const pages: string[][] = [];
  for (let i = 0; i < ids.length; i += perPage) {
    pages.push(ids.slice(i, i + perPage));
  }
  return pages;
}

export async function sendLanguagePicker(to: string): Promise<void> {
  const rows: ListRow[] = LANGS.map((l) => ({
    id: `${LANG_PREFIX}${l.id}`,
    title: clamp(l.label, MAX_ROW_TITLE),
  }));

  // Shown before we know the user's language, so the prompt itself carries
  // both scripts rather than guessing.
  await sendList(
    to,
    '👋 Welcome to Rafeeq  •  أهلاً بك في رفيق\n\n🌐 Choose your language  •  اختر لغتك',
    clamp('🌐 Language', MAX_BUTTON_TEXT),
    [{ title: 'Languages', rows }],
  );
}

/**
 * Sends the service menu as a SINGLE interactive list. Any acknowledgement
 * (e.g. "Language set to English.") is folded into the list body rather than
 * sent as a preceding text bubble — two sequential messages is what made the
 * menu easy to miss in the client demo.
 */
export async function sendServiceMenu(
  to: string,
  lang: string,
  options: { page?: number; ack?: string } = {},
): Promise<void> {
  const pages = servicePages();
  const page = Math.min(Math.max(options.page ?? 0, 0), pages.length - 1);

  const rows: ListRow[] = pages[page].map((id) => ({
    id: `${SERVICE_PREFIX}${id}`,
    title: clamp(serviceLabel(lang, id), MAX_ROW_TITLE),
  }));

  const nextPage = page + 1;
  if (nextPage < pages.length) {
    rows.push({
      id: `${PAGE_PREFIX}${nextPage}`,
      title: clamp(ui(lang, 'more'), MAX_ROW_TITLE),
      description: clamp(ui(lang, 'moreDesc'), MAX_ROW_DESCRIPTION),
    });
  }
  // Without this the later pages are a dead end — there's no WhatsApp-native
  // way back to the first page of a list.
  if (page > 0) {
    rows.push({
      id: `${PAGE_PREFIX}${page - 1}`,
      title: clamp(ui(lang, 'back'), MAX_ROW_TITLE),
      description: clamp(ui(lang, 'backDesc'), MAX_ROW_DESCRIPTION),
    });
  }

  const body = [options.ack, ui(lang, 'menuPrompt')]
    .filter(Boolean)
    .join('\n\n');

  await sendList(to, body, clamp(ui(lang, 'menuButton'), MAX_BUTTON_TEXT), [
    { title: clamp(ui(lang, 'servicesSection'), MAX_ROW_TITLE), rows },
  ]);
}
