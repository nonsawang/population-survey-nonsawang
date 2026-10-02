# HOSxP registry sync, first stage
Install migrations/20260930_hosxp_registry_sync.sql after the identity migration. Deploy the status RPC allowlist and UI together.

Run node scripts/hosxp-registry-sync.cjs first (dry-run). --apply updates names on Supabase only. The HOSxP connection uses a read-only transaction. This command does not create visits or call the import worker.

Only verified person_identity_links (staff-reviewed or registry-verified) are eligible. Verify CID, unique HOSxP person/patient, HN, date of birth and target mapping on every run. The database rechecks the web birth date, CID, duplicate rows, pending identity corrections and mapping under row locks. Names are audited, unchanged names cause no writes. Clinical histories, screening dates, house/village assignments and residency types are untouched. Unlinked people require the existing identity workflow; no guessed links or automatic merges.

Current implementation scans linked people and writes only changed names. It does not yet implement timestamp-based incremental fetching, scheduler installation, heartbeat or broad population onboarding. The displayed success time is the last accepted batch, not a complete-cycle heartbeat. Keep dry-run results before enabling --apply. Do not treat absent status as online. Production migration and first apply require verification against the actual schema before execution.

## General population linking (2026-10-01)
Apply 20260925_person_identity.sql, 20260930_hosxp_registry_sync.sql, then 20261001_registry_identity_link.sql. The third migration adds registry_verified provenance without manufacturing a duplicate-merge job. Existing reviewed links retain their audit job and provenance.

Run node scripts/hosxp-registry-link.cjs for a read-only preflight; --apply creates links only after unique CID, HN and birth-date validation against person/patient. Database rechecks current web identity, duplicate CID, pending merges and existing links under locks. This does not change names, screening data, or HOSxP. Afterwards run hosxp-registry-sync.cjs separately. No automatic scheduler is installed by these commands. Logs contain totals only. Conflicting rows require staff review.

Tests: node tests/registry-link.cjs. Production migrations installed 2026-10-01. Linking verified 12,774 out of 13,323 records; 549 skipped.

## Automatic names sync
Run Install-Registry-Sync.cmd on the LAN Windows account. It installs Nonsawang-Registry-Sync every 30 minutes and at logon, with IgnoreNew overlap prevention and a hidden, waiting wscript launcher. Only registered verified links are processed. HOSxP is read-only; the Supabase RPC updates names with audit records. It does not import visits or run FIT automation.
Configuration: lan-runtime/registry-auto.json (enabled false pauses future cycles). Log: lan-runtime/registry-auto.log; final complete-cycle result: lan-runtime/registry-status.json. Task Scheduler result 0 plus ok=true confirms cycle completion. The web status remains a last-batch timestamp, not a cycle heartbeat. The computer must be on, connected to LAN/Internet and the installed account signed in.
