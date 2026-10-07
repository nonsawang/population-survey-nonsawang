# NHSO Authen V1.1 — read-only

Reference: supplied เอกสารAPI_เพื่อคืนค่าข้อมูลสถานะการ_Authen_ให้หน่วยบริการV1.1.pdf, pages 1–7.
Production host: authenucws.nhso.go.th. Test host: test.nhso.go.th.
Bearer Kiosk Authentication Token from New Authen is required. No token exchange is specified. Never reuse a closing-rights token without confirming its scope.
personalId and serviceDate are required; serviceCode is optional. FIT service code remains unverified; PG0060001 is described as OPD/IPD/PP in this document.

checkStatus returns validated matches from serviceHistories, not raw demographics. It verifies personalId, provider, service date and an optional service code. Missing identity, ambiguity or malformed responses do not authorize writes. statusAuthen supports boolean and exact strings true/false because the table and example disagree. Cancellation status is always unknown: V1.1 has no explicit cancellation field. No outcome certifies claim eligibility.

Run `node tests/nhso-authen-status.cjs` for synthetic tests.
For the previously authorized VN 690911103821 / HN 0006422 / date 2026-09-22, run `node scripts/check-selected-authen-readonly.cjs` only after securely setting NHSO_KIOSK_TOKEN and NHSO_KIOSK_TOKEN_CONFIRMED=yes in the local process environment. No token command should be pasted into chat or stored in shell history. It reads HOSxP in a read-only transaction and prints only counts and comparison results; no raw CID, token or Claim Code. It never creates or updates HOSxP records and is not connected to the scheduler.

2026-10-07 connectivity probe: both documented URLs returned HTTP 500 with JSON content type when called without token or parameters. This only confirms an HTTP response, not successful authentication or schema support. No patient data or token was sent. Live authenticated retrieval is pending confirmation of the token type.
