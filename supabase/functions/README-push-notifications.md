# Mobile Web Push setup (feature branch)

This feature uses standard Web Push for Android and iPhone Home Screen web apps. Desktop subscriptions are blocked in the client. No notification message/history table is used.

## Required server secrets
Generate a VAPID key pair once (never regenerate after devices subscribe):
`npx web-push generate-vapid-keys`

Set these Supabase Edge Function secrets:
- `VAPID_PUBLIC_KEY` — public VAPID key
- `VAPID_PRIVATE_KEY` — private VAPID key (server only; never put in GitHub or Vercel)
- `VAPID_SUBJECT` — `mailto:bigcollectionbd@gmail.com`
- `PUSH_SYSTEM_SECRET` — long random secret used only by scheduled/internal calls

Set the Vercel Preview environment variable:
- `VITE_WEB_PUSH_VAPID_PUBLIC_KEY` — same public VAPID key

Do not add the private key or system secret to frontend environment variables.

## Functions
- Deploy `send-push` with JWT verification disabled; it validates either an owner access token (custom send) or the internal `x-push-secret`.
- Deploy `pickup-reminder` with JWT verification disabled; it accepts only the internal secret.
- Update `pathao-sync-all` and `pathao-check-status` to call `send-push` internally when a newly observed Pathao status becomes Delivered, On Hold, or Returned.
- Schedule `pickup-reminder` daily at 10:00 UTC (16:00 Asia/Dhaka) using pg_cron/pg_net. Do not create a notification-history table or log payloads.

Invalid Web Push endpoints returning HTTP 404/410 are removed automatically during a send. The reminder checks only Pending, Pickup_Requested and Assigned_for_Pickup; confirm the merchant's live Pathao status vocabulary before activating the schedule.
