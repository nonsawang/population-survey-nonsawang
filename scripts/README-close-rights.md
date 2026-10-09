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
