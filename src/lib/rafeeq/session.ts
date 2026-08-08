// Conversation state backed by Postgres (users + messages tables), so context
// survives restarts and works across instances.

import { getDb } from '../db.ts';
import { DEFAULT_LANG } from './config.ts';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface SessionContext {
  userId: string;
  lang: string;
  // Whether the user has actually picked a language, as opposed to `lang`
  // falling back to the default — drives whether the picker is shown.
  hasLang: boolean;
  stage: 'new' | 'active';
  activeService?: string;
  history: ChatTurn[];
}

// Messages older than this no longer count as conversation context — the
// thread effectively starts fresh (though everything stays stored).
const CONTEXT_WINDOW_MS = 6 * 60 * 60 * 1000;
// Cap the history sent to the model.
const MAX_HISTORY_MESSAGES = 20;

export async function loadSession(msisdn: string): Promise<SessionContext> {
  const db = getDb();

  const user = await db.user.upsert({
    where: { phone: msisdn },
    update: {},
    create: { phone: msisdn },
  });

  const cutoff = new Date(Date.now() - CONTEXT_WINDOW_MS);
  const recent = await db.message.findMany({
    where: { userId: user.id, createdAt: { gt: cutoff } },
    orderBy: { createdAt: 'desc' },
    take: MAX_HISTORY_MESSAGES,
  });
  recent.reverse();

  const history: ChatTurn[] = recent.map((m) => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content,
  }));

  return {
    userId: user.id,
    lang: user.lang ?? DEFAULT_LANG,
    hasLang: user.lang != null,
    stage: history.length === 0 ? 'new' : 'active',
    // An activeService left over from an expired conversation shouldn't leak
    // into a fresh one.
    activeService:
      history.length === 0 ? undefined : (user.activeService ?? undefined),
    history,
  };
}

export async function setLang(userId: string, lang: string): Promise<void> {
  const db = getDb();
  await db.user.update({ where: { id: userId }, data: { lang } });
}

export async function saveTurn(
  session: SessionContext,
  userText: string,
  assistantText: string,
  activeService: string | undefined,
): Promise<void> {
  const db = getDb();
  // Explicit timestamps 1ms apart so the pair always sorts user-then-assistant
  // even when both inserts land in the same millisecond.
  const now = Date.now();
  // One nested write rather than a three-statement $transaction: still atomic,
  // but a single round trip. The batched version could exceed Prisma's 5s
  // transaction timeout while waiting on a connection during a burst, which
  // silently lost the turn.
  await db.user.update({
    where: { id: session.userId },
    data: {
      activeService: activeService ?? null,
      messages: {
        createMany: {
          data: [
            { role: 'user', content: userText, createdAt: new Date(now) },
            {
              role: 'assistant',
              content: assistantText,
              createdAt: new Date(now + 1),
            },
          ],
        },
      },
    },
  });
}
