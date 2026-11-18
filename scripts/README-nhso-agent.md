# NHSO Agent queue (manual FIT closure)

This feature is implemented but DISABLED until migration, station registration, deployment and supervised endpoint validation are complete. No production POST is needed for installation/testing. The source contract is the supplied 9-page NHSO SecureSmartCardAgent v2.0 manual, pages 4–7. Confirm actual Agent build/profile locally before enabling sends.

## Deployment order
1. Back up and apply migrations/20261116_nhso_agent_queue.sql after existing FIT intents/reservation migrations. Do not reapply. It fences the old direct reservation path for agent intents. No existing queue is converted automatically.
2. Register a station using a stable non-secret identifier and human-readable computer label in nhso_agent_stations. Set enabled=true only for the designated machine with the card reader. This table is not writable from the browser.
3. Deploy API and UI together. Set NHSO_AGENT_QUEUE_ENABLED=true on Vercel after migration. This makes the old direct request endpoint reject new manual requests; already queued direct work is unchanged.
4. On the card-reader Windows machine configure .env.sync: NHSO_AGENT_STATION_ID=<registered id>, NHSO_HCODE=<5 digits>, NHSO_AGENT_READ_ENABLED=true, NHSO_AGENT_SEND_ENABLED=false, NHSO_AGENT_PRODUCTION_VERIFIED=false. Existing Supabase and HOSxP connection settings remain server/LAN-only. Token stays inside Agent userconfig.properties, not this worker or browser.
5. Run node scripts/nhso-agent-worker.cjs --watch in the logged-in Windows session with the reader. A pass every 5 seconds claims at most one read. Do not use an unrelated server with no reader. Multiple workers use atomic DB claims; running a second instance is unnecessary.
6. On web select that station, insert the intended card, click read; validate identity/rights and supported claimTypes. Worker never falls back to read-card-only for entitlement. Unsupported claimTypes shapes fail closed; verify installed build if no service appears.
7. Verify all tests and a supervised service contract. Only then set NHSO_AGENT_PRODUCTION_VERIFIED=true and NHSO_AGENT_SEND_ENABLED=true on LAN. Staff must independently tick review and click confirm for each same-day FIT visit. These flags alone never create an intent.

## Data and writeback
Fresh read evidence expires after 15 minutes and is bound to staff, person, station. Browser status never receives CID/correlationId. The configured existing general service PG0060001 must appear in Agent claimTypes; FIT positive/negative codes are not guessed. UI shows the existing FIT split 0 paid/60 privilege; loader verifies actual visit and vn_stat match, otherwise stops without sending.

The worker checks live visit identity, saved result, lab, fee, PP visit type and amounts using existing loader; obtains actual mainInscl from read evidence. It atomically reserves the existing nhso_close_submissions ledger, calls ONLY fixed loopback POST /api/nhso-service/save-endpoint, saves an encrypted DPAPI-backed receipt and acknowledges the ledger. No HTTP retry, redirects or fallback to direct NHSO API.

Existing FIT reconciliation/writeback service consumes the confirmed ledger to write HOSxP and verifies receipts; keep that service operational. Agent worker does not directly write HOSxP. Display confirmed and written separately.

## Recovery
If response is lost or process dies after reservation: never auto-release or resend. Inspect receipt and external outcome. If an encrypted receipt exists, node scripts/nhso-agent-worker.cjs recover <intent-id> acknowledges it without API submission. A missing receipt requires manual reconciliation. Unknown outcomes remain reserved/reconcile.

## Checks
node tests/nhso-agent-transport.cjs
node tests/nhso-agent-queue.cjs
node tests/nhso-close-live-loader.cjs
node tests/fit-close-reservation.cjs

No scheduled task, migration, Vercel flag or production transmission is enabled merely by adding these files. Keep existing approval/audit evidence. Station online means worker heartbeat, not proof Token or reader is valid. No patient data/Token is written into console output.
