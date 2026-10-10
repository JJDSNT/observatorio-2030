# Observatório 2030 — Web Push backend

Minimal Cloudflare Worker + D1 backend for PWA Web Push subscriptions.

## Architecture

PWA -> Worker /subscribe -> D1  
New milestone -> GitHub Actions -> Worker /notify -> Web Push -> installed PWA

GitHub remains the source of truth. The Worker only stores browser subscriptions and delivers notifications.

## Setup

1. Create a Cloudflare D1 database named `observatorio-2030-push`.
2. Put its ID in `wrangler.toml`.
3. Generate a VAPID key pair.
4. Configure Worker secrets: `PUSH_API_TOKEN`, `VAPID_PRIVATE_KEY`.
5. Configure Worker variables/secrets: `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT` (for example `mailto:...`).
6. Run `npm install`, initialize D1 with `npm run db:init`, then `npm run deploy`.
7. Add GitHub repository secrets `PUSH_ENDPOINT` and `PUSH_API_TOKEN`.
8. Configure the PWA with the Worker URL and VAPID public key.

## HTTP endpoints

- `GET /health` — health check.
- `GET /vapid-public-key` — returns the public VAPID key used by `PushManager.subscribe()`.
- `POST /subscribe` — creates or updates a browser subscription from the allowed PWA origin.
- `DELETE /subscribe` — removes a browser subscription.
- `POST /notify` — sends a milestone notification; requires `Authorization: Bearer <PUSH_API_TOKEN>`.

Production endpoint: <https://observatorio-2030-push.jaimejosediasnt.workers.dev>

Push delivery is deliberately separate from editorial decisions: only a newly added event with a stable `id` should trigger a notification.
