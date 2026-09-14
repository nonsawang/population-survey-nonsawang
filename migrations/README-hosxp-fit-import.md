# FIT import preparation

Status: catalog verification only. No writer, queue or import button is enabled.

Run `node scripts/hosxp-fit-preflight.cjs` on the LAN computer with the existing `.env.sync` and project dependencies. It opens a read-only transaction, queries catalogs only, verifies mappings and never allocates a serial or writes a patient record. Errors omit database responses and credentials.

Verified against the configured HOSxP database on 2026-09-14:

| Setting | Code | Description |
|---|---|---|
| Department | 048 | ฝ่ายส่งเสริมสุขภาพ |
| Specialty | 15 | อื่น ๆ |
| Provider | 0029 | กฤตพล |
| FIT lab | 10214 | fit test |
| Fee item | 3905544 | FIT screening |
| Diagnosis | Z121 | User-provided FIT visit template |

User confirmed the department, specialty and provider for all screening types. Diagnosis and lab mapping apply only to FIT. The example PDF's local fee codes do not match this database. Do not reuse those example codes.

The web currently stores FIT as ปกติ/ผิดปกติ; the lab catalog accepts Negative/Positive. Confirm that translation for the import preview before delivery. PP exists in the catalog but the user's confirmation covered department/specialty/provider; do not globally replace patient entitlement with PP. Do not copy vitals from the screenshot.

Remaining implementation: immutable queued payload after staff review; unique patient/CID match; target preview and conflict checks; one new visit per screening type with a durable idempotency key; LAN worker with transaction and retry recovery; VN acknowledgement; UI status; test-database round trip. Multiple event revisions for the same screening must not silently create duplicate visits. A committed HOSxP transaction followed by a failed cloud acknowledgement must recover the existing VN.

The existing serial function changes transaction isolation internally; do not invoke it inside a writer transaction without verifying its transaction behavior and concurrency with HOSxP. The presence of InnoDB tables does not by itself validate the complete visit registration workflow.

Validation: `node tests/hosxp-fit-preflight.cjs`, plus a successful read-only live preflight. No visit has been created and no deployment or schema migration is needed for this preparation script.

## Preparation UI added 2026-09-14

Applied `20260914_fit_preparation.sql` to the configured Supabase project successfully. Do not rerun this table-creation migration. Staff/admin can preview an approved current FIT event, confirm the proposed Negative/Positive translation, and persist an immutable preparation. Repeated calls reuse the same preparation; a different event for the same person/date is rejected. VHV cannot read or prepare these records. Status is exclusively `awaiting_lan_validation`; these records are NOT write authorization and no worker should import them automatically.

UI lives in `components/FitPreparation.js`, attached to approved FIT rows in ScreeningReview. Publish frontend/API changes together after the migration. Local SQL tests and Next production build passed. Git commit was blocked by `.git/index.lock` permission denied; user must Commit & Sync using VS Code before the menu appears in production. HOSxP patient matching, entitlement/visit time selection, transactional visit writer, acknowledgement and test-database validation remain unimplemented.
