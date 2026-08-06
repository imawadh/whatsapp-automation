// In-memory conversation state, keyed by the sender's phone number (msisdn).
// Good enough for a single server instance; state is lost on restart and not
// shared across instances — move to Postgres (Prisma) when that matters.

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface Session {
  lang: string;
  stage: 'new' | 'active';
  activeService?: string;
  history: ChatTurn[];
  lastSeenAt: number;
}

// A conversation that has been quiet this long starts over fresh.
const SESSION_TTL_MS = 6 * 60 * 60 * 1000;
// Cap the history sent to the model; older turns fall off the front.
const MAX_HISTORY_TURNS = 20;

const sessions = new Map<string, Session>();

export function getSession(msisdn: string): Session {
  const existing = sessions.get(msisdn);
  if (existing && Date.now() - existing.lastSeenAt < SESSION_TTL_MS) {
    return existing;
  }
  const fresh: Session = {
    lang: 'en',
    stage: 'new',
    history: [],
    lastSeenAt: Date.now(),
  };
  sessions.set(msisdn, fresh);
  return fresh;
}

export function recordTurn(
  session: Session,
  userText: string,
  assistantText: string,
): void {
  session.history.push(
    { role: 'user', content: userText },
    { role: 'assistant', content: assistantText },
  );
  if (session.history.length > MAX_HISTORY_TURNS) {
    session.history.splice(0, session.history.length - MAX_HISTORY_TURNS);
  }
  session.stage = 'active';
  session.lastSeenAt = Date.now();
}
