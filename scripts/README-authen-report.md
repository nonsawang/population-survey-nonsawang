# Authen report matching

Replaces the proposed live NHSO API lookup with an uploaded New Authen `.xlsx` report. No NHSO token is needed. Staff approval queues a LAN write to fill an empty `visit_pttype.auth_code`. It never issues Authen, certifies a lab result, or marks a claim ready.

Install `migrations/20260923_authen_report.sql` in Supabase and `scripts/hosxp-authen-ledger.sql` in HOSxP, deploy the web app with `exceljs`, and update the existing LAN connector code. Each scheduled cycle checks one pending report and processes at most one approved Authen row after the existing FIT work. Both upload and approval require a current staff/admin session; raw tables have RLS with no public access.

On `/hosxp-review`, upload the original report, wait for a LAN cycle, and click “ตรวจผลล่าสุด”. Review service meaning and active status, select unambiguous rows and confirm. A blank report status requires staff verification outside the file. Approval records the actor/time and expires for unreviewed results after 24 hours. It is not approval of claim eligibility.

Matching uses exact CID + actual current HOSxP service date, checks full name without whitespace and optional HN, requires a single visit; staff must verify the displayed service type. Multiple visits/rows, conflicting existing codes, reused codes, invalid CID, cancellation and other facilities block acceptance. Dates are never moved to today. The report's displayed service code is preserved; no PP service mapping is inferred.

File limits: one worksheet, 500 rows, 2 MB compressed and 16 MB declared expanded ZIP size. Formulas and complex cell values are rejected. Duplicate files reopen the original batch. The workbook is parsed on the server; only required normalized fields are retained, excluding telephone, birth date and insurance details. No raw report or patient data belongs in Git or logs.

Tests: `node tests/authen-report.cjs`, `node tests/authen-report-database.cjs`, `node tests/authen-write.cjs`.

The writer uses an advisory lock, InnoDB transactions, exact patient/date/VN/name checks, one insurance row, empty-only conditional update and readback. Different codes, ambiguous visits, reused codes or expired approvals are blocked. A local receipt commits in the same transaction and supports recovery if the cloud acknowledgment fails. Already-present matching codes are verified without rewriting. Blocked rows require review; they are never silently retried as approved changes. The original report and clinical dates remain unchanged.
