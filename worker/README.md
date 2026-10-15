# Mood Tracker reminder Worker

A Cloudflare Worker whose cron trigger sends "Track your mood" push
notifications three times a day through Expo's push service.

## How it works

The cron trigger runs **hourly**. On each run the Worker checks the wall-clock
hour in `REMINDER_TIMEZONE` and only sends when that hour is listed in
`REMINDER_HOURS`. Encoding local times directly as UTC crons would drift by an
hour twice a year; checking the timezone at run time keeps the reminders at the
same local time year-round.

Device push tokens are kept in a KV namespace. The app posts its token to
`/register` on launch; the Worker prunes any token Expo reports as
`DeviceNotRegistered`.

Twenty-four cron invocations a day sits comfortably inside the Workers free
tier.

## Deploy

```bash
cd worker
npm install
```

**1. Create the KV namespace** and paste the returned id into `wrangler.toml`
under `[[kv_namespaces]]`:

```bash
npx wrangler kv namespace create TOKENS
```

**2. Set the shared secret.** The app sends this as a bearer token when
registering. Generate something long and random:

```bash
openssl rand -hex 32
npx wrangler secret put REGISTRATION_SECRET
```

Use the same value for `extra.reminderWorkerSecret` in `../app.json`.

**3. Set your timezone and reminder hours** in `wrangler.toml`:

```toml
[vars]
REMINDER_TIMEZONE = "America/Toronto"   # any IANA timezone
REMINDER_HOURS = "9,14,20"              # local hours, 0-23
```

**4. Deploy:**

```bash
npx wrangler deploy
```

Cron triggers are registered automatically from `wrangler.toml`.

## Endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health` | none | token count, timezone, reminder hours, current local hour |
| `POST` | `/register` | bearer | store a device token — `{ "token": "ExponentPushToken[…]", "platform": "ios" }` |
| `POST` | `/unregister` | bearer | remove a device token |
| `POST` | `/send` | bearer | send reminders immediately, ignoring the schedule (for testing) |

Auth is `Authorization: Bearer $REGISTRATION_SECRET`.

## Testing

Check what the Worker thinks the time is:

```bash
curl https://mood-tracker-reminders.<you>.workers.dev/health
```

Fire a reminder right now:

```bash
curl -X POST https://mood-tracker-reminders.<you>.workers.dev/send \
  -H "Authorization: Bearer $REGISTRATION_SECRET"
```

The response reports `sent`, `failed`, any `pruned` tokens, and per-token
errors. `{"errors": ["No registered tokens."]}` means the app has not registered
yet — open the app's **Reminders** screen and tap **Get token & register**.

Locally:

```bash
cp .dev.vars.example .dev.vars    # then edit in your secret
npx wrangler dev --test-scheduled

curl http://127.0.0.1:8787/health
curl "http://127.0.0.1:8787/cdn-cgi/handler/scheduled?cron=0+*+*+*+*"
```

The scheduled handler logs whether it sent or skipped, and why. Use
`npx wrangler tail` to watch the same logs in production.

## If push notifications enabled on expo.dev

If you turn on push security for your Expo project, create an access token at
`expo.dev → Account Settings → Access Tokens` and add it:

```bash
npx wrangler secret put EXPO_ACCESS_TOKEN
```

The Worker sends it automatically when present.
