# Close-rights scaffold (mock only)

This is separate from GET Authen lookup. No app route or scheduler calls this module.
SCHEMA_CONFIRMED remains false: the attached vendor diff is reference evidence, not proof of a current official contract or successful requests.

Run: node tests/nhso-close-rights.cjs

submitClose requires mode=mock and an injected test transport. There is no default fetch and production is rejected. Do not inject a real transport until the API contract and operational workflow are verified.

The provisional raw Authorization header, test URL and response seq/authenCode follow the supplied diff. No vendor cookies, runtime settings, logs or credentials are copied. TLS settings are not changed.

All ambiguous responses, including HTTP 409, timeout, network failure and malformed success bodies, prohibit automatic retry. A local timeout does not establish that the remote server rejected a transaction. Simulated results are explicitly marked and must never be recorded as real closure evidence.

## Required before live integration

- Map visitNumber, service time and amounts from a validated visit snapshot. mainInsclCode comes from that visit's patient entitlement; claimServiceCode follows the actual service. sourceId and department require verified configuration, not invented defaults.
- Verify official field types, amount relationships, Authorization format and response semantics in the sandbox using approved test records.
- Implement a durable submission ledger with atomic reservation and a unique business key scoped by facility, visit, service and zone. Persist the request fingerprint and stable transactionId before transmission, excluding tokens. Block concurrent attempts and changed payloads under the same key.
- Persist outcomes and support reconciliation for process crashes or lost responses. A process restart must not resend an unresolved submission. Remote idempotency and reconciliation endpoints are still unverified.
- Add access control and a reviewed migration for result storage before attaching a live UI or LAN writer.

No database migration, HOSxP write, real API submission or end-to-end idempotency guarantee is included in this scaffold.

## Prepared ledger migration (2026-10-07)

20261007_nhso_close_ledger.sql adds service-role-only reservation and acknowledgement RPCs. It is not installed automatically. Reservations use a unique facility/visit/service/zone key and INSERT ON CONFLICT, and never expire into a resend. Every existing reservation returns acquired=false, including repeated requests from the same owner. A changed request hash blocks the call. Acknowledgements are owner-bound and confirmed results cannot be overwritten.

Before any sender is connected, implement a canonical request fingerprint excluding credentials and server-assigned transactionId, persist reservation before sending, and reconcile reserved/unknown records after crashes. Do not write simulated responses to this ledger as actual evidence. The migration currently allows reservations only for test.

tests/nhso-close-ledger.sql is a rollback-only sequential test for an isolated database. It is not a concurrency test. Actual PostgreSQL execution, two-session contention tests and role privilege checks remain required before deployment. No production migration was run.

## Dispatcher and acknowledgement recovery

scripts/nhso-close-dispatch.cjs connects reserve -> mock submit -> record through an RPC adapter for an explicitly isolated test database. It computes a canonical request hash without the token or server-assigned transactionId, then sends using the ledger transactionId. Any existing or uncertain reservation blocks submission.

If the simulated remote response succeeds but the record RPC fails, the dispatcher returns ack_pending and a receipt. retryRecord only retries the record RPC and never invokes the remote sender. This also handles a lost acknowledgement response after the database committed. Receipts contain sensitive results: do not print or expose them publicly.

Run node tests/nhso-close-dispatch.cjs. These fault-injection tests use a mock ledger and mock HTTP transport; they do not constitute a combined PostgreSQL/HTTP integration test. The adapter has not been activated against production. A durable protected receipt store and reconciliation are still needed for process termination between receiving the remote response and saving the receipt. In that window the reserved ledger blocks duplicate transmission, but cannot recover the missing remote code by itself. No automatic resend is permitted.

## Windows key management and integrated fault test

nhso-receipt-key.ps1 creates a 32-byte random key protected by Windows DPAPI CurrentUser. Creation refuses to overwrite an existing key; loading never silently regenerates it. The Node wrapper uses a private child-process pipe and sanitized errors. Run recovery under the same Windows account/profile. Do not delete or rotate the protected key while receipts depend on it. This is not protection against malicious code running as that same user; restrict the directory using deployment ACLs. Key backup/profile recovery and rotation are not automated.

The local Run-Ledger-Test.cmd now includes tests/nhso-close-postgres.cjs: real PostgreSQL ledger RPCs through psql plus a simulated HTTP transport. It tests key reloading, encrypted receipt recovery after acknowledgement failure, and a child process exiting with code 77 after receiving the simulated successful response but before saving a receipt. The last case must remain reserved; the result code is unavailable, and reconciliation is required instead of resubmission. This test is not a power-loss durability guarantee or a real NHSO API test. The integrated test must be run directly on Windows if initdb stalls inside the agent sandbox.

## Contract correction after Test Zone Swagger inspection

Authorization now uses Bearer, matching the live Swagger security scheme. sourceId is limited to 50 characters, visitNumber to 30 and transactionId to 255. Any nonempty dataError blocks success even if seq/authenCode are present. Tests cover these conditions.

Production Token authorization by the operator is recorded in the conversation, but no production request has been sent. The transport remains mock-only: the exact date representation (Swagger int32 versus the reference client's epoch milliseconds), trusted HOSxP visit/entitlement/amount mapping and server-side enforcement of the manual staff confirmation remain unresolved. Frontend card matching alone is not a server-side authorization mechanism. Do not enable a Production URL merely by changing the test-only guard.

## Dataset v10.1 validation (2026-10-08)

Outgoing transactionId is HCODE + the immutable ledger UUID. The UUID column remains the internal unique suffix; every retry/reconciliation must use the same prefix and suffix. No database migration is required for this composition. The request validator rejects missing or mismatched HCODE prefixes.

serviceDateTime and invoiceDateTime remain epoch milliseconds, now rejecting values later than the validation clock. Amount fields accept finite nonnegative numbers up to 99999999.99 with at most two decimal places; the validator does not round financial values silently. Boundary tests cover all three amount fields and both dates. Transport remains mock-only. This supersedes the earlier unresolved date-unit note: dataset pages 19 and 21 explicitly document milliseconds and no future dates.

## FIT eligibility policy scaffold

nhso-fit-close-policy.cjs validates a trusted screening/visit/manual-approval snapshot and separates the next action after closure confirmation from the HOSxP write outcome. It requires a saved normal/abnormal FIT result, matching CID/date, 6000 satang total, verified service mapping, actual entitlement and an explicit split of charges. PP is the service group, never a replacement for entitlement.

This policy is not yet wired to a database snapshot loader, authenticated approval endpoint or live writer. Approval freshness/card attestation and persistence remain required. nextCloseAction is a pure decision helper, not a persistent HOSxP retry queue. Do not treat its tests as end-to-end production authorization.

## Service code separation (2026-10-09)

No PP0040003 mapping is configured. Do not derive a close-rights claimServiceCode from FIT normal/abnormal results, Authen serviceCode or e-Claim ADP.CODE. These require separate contract evidence.

nhso-close-service-config.cjs resolves a code from trusted server/LAN configuration scoped to facility, zone and screening type. The example config has no code and is disabled. Enable only after recording the nhso-claim-detail reference and verifier. Verification metadata is an operator attestation, not proof supplied by the browser. The policy rejects a conflicting visit code and requires actor.closeAllowed=true from the authenticated permission lookup in addition to staff/admin role.

The readiness endpoint explicitly reports the missing close-service configuration. Configuration loading, trusted snapshot creation and manual approval enforcement are still not connected to live sending; this change does not enable a Production request. Run tests/nhso-close-service-config.cjs and tests/nhso-fit-close-policy.cjs.

## FIT Authen writeback adapter

hosxp-fit-auth-writeback.cjs writes a confirmed test ledger authen_code to visit_pttype.auth_code for the VN already recorded by survey_fit_import_ledger. It locks both records, requires one PP rights row and InnoDB, refuses a different existing code, reads back the result and treats an identical code as an idempotent replay. It never calls an NHSO sender. Seq remains in the source closure ledger. Export verification remains false.

The adapter currently requires isolatedTestDatabase=true and rejects production evidence. Tests use a fake SQL connection including a committed write with a lost acknowledgement; they are not a real MySQL concurrency test. A production ledger loader, cross-database screening/closure binding and authenticated manual approval are still required before enabling it. No real HOSxP data was changed.

The test-only hosxp-fit-auth-queue.cjs loads queue/evidence using a service-role client, writes MySQL, then acknowledges the queue. Missing acknowledgement returns ack_pending; retries read back the same code. Migration 20261009_fit_auth_writeback_queue.sql is prepared, not installed. The MariaDB integration test uses real InnoDB tables but a simulated Supabase client. It covers 8 concurrent connections, lost commit acknowledgement and queue acknowledgement failure. Current sandbox runs timed out connecting to localhost:33317; no integration PASS is claimed.

## Production transport adapter (not activated)
nhso-close-production.cjs constructs the fixed HTTPS Production URL and requires explicit enablement plus reserveManualIntent/record and a durable receipt store. Only same-day Bangkok service/invoice dates are allowed. It performs one HTTP request after reservation, persists the response before acknowledgement, and never retries a remote request. Tests inject mocked HTTP; no NHSO request was sent. The existing test reservation RPC is incompatible by design: the production reserveManualIntent database function and trusted snapshot loader remain to be implemented. Production receipt stores must use a separate directory with production=true; simulation receipts are rejected by that store. This adapter is not connected to a route or scheduler and does not make the web workflow live.

Production reservation and loader: 20261012_fit_close_reservation.sql validates persisted manual intent, captured card CID, current result/date/import and actor permission under locks. It reserves a single ledger row atomically and rejects changed payloads. nhso-close-live-loader.cjs reads actual MySQL FIT/amount/entitlement records and connects processCloseIntent to sendProduction. This requires explicitly configured staff recorder CIDs, facility/source/department/token and encrypted receipts. Default remains disabled. Reservation tests passed in PGlite; MySQL loader tests use fixture query responses, not a live database. Migrations have not been installed. Configuration, full cross-database integration and UI activation are still pending.
