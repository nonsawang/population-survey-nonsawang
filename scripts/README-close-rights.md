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
