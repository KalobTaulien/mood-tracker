/**
 * Mood Tracker reminder Worker.
 *
 * The cron trigger fires hourly; the Worker then checks the wall-clock hour in
 * REMINDER_TIMEZONE and only sends on the three configured hours. Doing the check
 * here (rather than encoding local times as UTC crons) keeps the reminders at the
 * same local time across daylight-saving changes.
 *
 * Endpoints:
 *   POST /register    { token, platform }   — store a device token (auth required)
 *   POST /unregister  { token }             — remove a device token (auth required)
 *   POST /send                              — fire reminders now, for testing (auth required)
 *   GET  /health                            — token count and schedule info
 */

export type Env = {
  TOKENS: KVNamespace;
  /** Shared secret the app sends as `Authorization: Bearer <secret>`. */
  REGISTRATION_SECRET: string;
  /** Optional Expo access token, required only if push security is enabled on expo.dev. */
  EXPO_ACCESS_TOKEN?: string;
  /** IANA timezone the reminder hours are expressed in, e.g. "America/Toronto". */
  REMINDER_TIMEZONE?: string;
  /** Comma-separated local hours (0-23) to send on, e.g. "9,14,20". */
  REMINDER_HOURS?: string;
};

const DEFAULT_TIMEZONE = 'America/Toronto';
const DEFAULT_HOURS = '9,14,20';

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';
const TOKEN_PREFIX = 'token:';
const REMINDER_TITLE = 'Track your mood';
const REMINDER_BODY = 'A quick check-in — it only takes a moment.';

type StoredToken = {
  token: string;
  platform: string;
  registeredAt: string;
};

type ExpoPushTicket = {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
};

function reminderHours(env: Env): number[] {
  return (env.REMINDER_HOURS ?? DEFAULT_HOURS)
    .split(',')
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((hour) => Number.isInteger(hour) && hour >= 0 && hour <= 23);
}

/** Wall-clock hour in the configured timezone, so DST shifts are handled for us. */
function localHour(env: Env, at: Date): number {
  const timeZone = env.REMINDER_TIMEZONE ?? DEFAULT_TIMEZONE;
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    hour12: false,
  }).format(at);
  // Intl can return "24" for midnight in hour12:false mode on some ICU versions.
  return Number.parseInt(formatted, 10) % 24;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isAuthorized(request: Request, env: Env): boolean {
  const secret = env.REGISTRATION_SECRET;
  if (!secret) return false;
  const header = request.headers.get('Authorization') ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : '';
  // Constant-time-ish compare: bail on length first, then diff every byte.
  if (provided.length !== secret.length) return false;
  let mismatch = 0;
  for (let i = 0; i < secret.length; i++) {
    mismatch |= provided.charCodeAt(i) ^ secret.charCodeAt(i);
  }
  return mismatch === 0;
}

function isValidExpoToken(token: unknown): token is string {
  return (
    typeof token === 'string' &&
    /^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$/.test(token)
  );
}

async function listTokens(env: Env): Promise<StoredToken[]> {
  const tokens: StoredToken[] = [];
  let cursor: string | undefined;

  do {
    const page = await env.TOKENS.list({ prefix: TOKEN_PREFIX, cursor });
    for (const key of page.keys) {
      const stored = await env.TOKENS.get<StoredToken>(key.name, 'json');
      if (stored?.token) tokens.push(stored);
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  return tokens;
}

/** Sends one reminder per registered device and prunes tokens Expo rejects. */
async function sendReminders(env: Env): Promise<{
  sent: number;
  failed: number;
  pruned: string[];
  errors: string[];
}> {
  const stored = await listTokens(env);
  if (stored.length === 0) {
    return { sent: 0, failed: 0, pruned: [], errors: ['No registered tokens.'] };
  }

  const messages = stored.map((entry) => ({
    to: entry.token,
    title: REMINDER_TITLE,
    body: REMINDER_BODY,
    sound: 'default',
    priority: 'high',
    // Opens the log screen; expo-router reads this in the root layout.
    data: { url: '/' },
  }));

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'Accept-Encoding': 'gzip, deflate',
  };
  if (env.EXPO_ACCESS_TOKEN) {
    headers.Authorization = `Bearer ${env.EXPO_ACCESS_TOKEN}`;
  }

  const response = await fetch(EXPO_PUSH_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    const text = await response.text();
    return {
      sent: 0,
      failed: stored.length,
      pruned: [],
      errors: [`Expo push service returned ${response.status}: ${text.slice(0, 400)}`],
    };
  }

  const payload = (await response.json()) as { data?: ExpoPushTicket[] };
  const tickets = payload.data ?? [];
  const pruned: string[] = [];
  const errors: string[] = [];
  let sent = 0;
  let failed = 0;

  for (const [index, ticket] of tickets.entries()) {
    if (ticket.status === 'ok') {
      sent += 1;
      continue;
    }
    failed += 1;
    const token = stored[index]?.token;
    errors.push(`${token ?? 'unknown'}: ${ticket.message ?? 'unknown error'}`);
    // A dead device never comes back; drop it so the list stays clean.
    if (ticket.details?.error === 'DeviceNotRegistered' && token) {
      await env.TOKENS.delete(`${TOKEN_PREFIX}${token}`);
      pruned.push(token);
    }
  }

  return { sent, failed, pruned, errors };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health' && request.method === 'GET') {
      const tokens = await listTokens(env);
      return json({
        ok: true,
        registeredDevices: tokens.length,
        platforms: tokens.map((t) => t.platform),
        timezone: env.REMINDER_TIMEZONE ?? DEFAULT_TIMEZONE,
        reminderHours: reminderHours(env),
        currentLocalHour: localHour(env, new Date()),
      });
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    if (!isAuthorized(request, env)) {
      return json({ error: 'Unauthorized' }, 401);
    }

    if (url.pathname === '/register') {
      let body: { token?: unknown; platform?: unknown };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return json({ error: 'Invalid JSON body' }, 400);
      }
      if (!isValidExpoToken(body.token)) {
        return json({ error: 'Expected an ExpoPushToken[...] value in `token`' }, 400);
      }
      const entry: StoredToken = {
        token: body.token,
        platform: typeof body.platform === 'string' ? body.platform : 'unknown',
        registeredAt: new Date().toISOString(),
      };
      await env.TOKENS.put(`${TOKEN_PREFIX}${entry.token}`, JSON.stringify(entry));
      return json({ ok: true, registered: entry.token });
    }

    if (url.pathname === '/unregister') {
      let body: { token?: unknown };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return json({ error: 'Invalid JSON body' }, 400);
      }
      if (!isValidExpoToken(body.token)) {
        return json({ error: 'Expected an ExpoPushToken[...] value in `token`' }, 400);
      }
      await env.TOKENS.delete(`${TOKEN_PREFIX}${body.token}`);
      return json({ ok: true, unregistered: body.token });
    }

    if (url.pathname === '/send') {
      const result = await sendReminders(env);
      return json({ ok: result.failed === 0, ...result });
    }

    return json({ error: 'Not found' }, 404);
  },

  async scheduled(event: ScheduledController, env: Env): Promise<void> {
    const firedAt = new Date(event.scheduledTime);
    const hour = localHour(env, firedAt);
    const hours = reminderHours(env);

    if (!hours.includes(hour)) {
      console.log(
        JSON.stringify({
          skipped: true,
          localHour: hour,
          reminderHours: hours,
          timezone: env.REMINDER_TIMEZONE ?? DEFAULT_TIMEZONE,
        })
      );
      return;
    }

    const result = await sendReminders(env);
    console.log(
      JSON.stringify({
        cron: event.cron,
        scheduledTime: firedAt.toISOString(),
        localHour: hour,
        ...result,
      })
    );
  },
};
