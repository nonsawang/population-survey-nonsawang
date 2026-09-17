# FIT visit writer (17 September 2026)

Creates one **explicitly selected** reviewed FIT preparation. It does not scan/import the whole queue. Keep `HOSXP_IMPORT_ENABLED` disabled until the site's first visit has been checked in the HOSxP application. This implementation has automated transaction/failure tests; those are not a substitute for that application-level verification.

## Installation

1. Apply `migrations/20260917_fit_import_results.sql` to Supabase. It adds a staff-only status RPC and a service-role-only outcome table; it does not change screening history, baseline provenance, or preparation payloads.
2. Apply `scripts/hosxp-fit-ledger.sql` to the connected HOSxP database. This adds one InnoDB idempotency ledger. No existing HOSxP catalog is altered.
3. Deploy the API allowlist and `FitImportStatus` component together. The web app does not receive database credentials. LAN uses outbound HTTPS to Supabase and the existing local MySQL connection.
4. Refresh the existing hybrid snapshot and select an approved preparation UUID. Run the command without write flags first:

```powershell
node scripts/hosxp-fit-import.cjs --job=<preparation-uuid>
```

For the selected real import, set `HOSXP_IMPORT_ENABLED=true` in the LAN configuration and use both flags:

```powershell
node scripts/hosxp-fit-import.cjs --job=<preparation-uuid> --write --confirm-fit-write
```

Do not put credentials or patient identifiers in command lines/logs. The job ID identifies a preparation; `history_id` is a different ID.

## Transaction and recovery

The writer checks approval, source result/date, unique CID, snapshot age, live patient/person identity, HN linkage, death status and existing FIT for that date. It checks again before commit. In one InnoDB transaction it writes `ovst`, `ovst_seq`, `opdscreen`, `ovstdiag`, `vn_stat`, `visit_pttype`, `lab_head`, `lab_order`, the FIT-only `opitemrece`, and the ledger. Any failure rolls back the transaction.

VN uses the local Buddhist-year/date/time format and a unique VN index; a collision stops with `VN_COLLISION_RETRY`, never overwrites a visit. HOSxP serial rows are locked and incremented within the transaction. A per-preparation database lock and unique ledger keys prevent duplicate connector imports. Readback validates patient, date, result, diagnosis and related rows before/after commit.

If Supabase acknowledgement fails after commit, keep the ledger and rerun the **same UUID**. The connector reads the committed visit and returns its existing VN, including when the latest screening has subsequently changed. Never delete a ledger entry to retry. `READBACK_MISMATCH` requires investigation, not reimport.

Policy `fit-visit-20260917` explicitly records PP entitlement, screening date as visit date, import-time clock, department 048, specialty 15, doctor 0029, Z121, lab 10214 and FIT fee 3905544 (60 baht). Legacy preparation payloads are not rewritten. Conflicting explicit policy values are rejected. The separate 100-baht outpatient fee seen in the historical example is not automatically added. No vitals, specimen receipt, lab certification, Authen Code, invoice or payment completion are invented.

Imported result is saved with lab confirmation `N`: lab certification remains in HOSxP. Dates reflect the reviewed screening event, while the ledger records the actual import time. This writer currently covers FIT only; no implicit HBV/HCV/HPV/child writer is enabled.

## Import versus claim readiness

Successful readback creates `import_status=imported` and returns VN/lab order number. `claim_status` remains `not_ready`. The read-only checks report current mapping, Authen Code and a finance reference. A finance reference is not sufficient proof of a valid NDP export; `export_verified` stays false until the unit's exported Finance/NDP data can be validated. No claim is submitted by this connector.

Observed live on 17 September: fee 3905544 uses ADP type 4/code 90005 and empty Bill Code, unlike the supplied guide's example (type 15/code 31209). Do not automatically change this shared catalog: resolve local billing mapping before enabling a claim-ready verifier. The database constraint prevents `ready` unless all evidence flags are true. There is deliberately no staff browser endpoint that can forge these flags.

Before enabling unattended operation, verify the first VN in HOSxP: patient, PP, visit date/time, Z121, FIT result/date and the single 60-baht fee, then compare the unit's Finance export. Scheduler installation and automatic NDP submission are not included.
