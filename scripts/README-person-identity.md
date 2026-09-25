# Staff-reviewed person identity correction

Apply `migrations/20260925_person_identity.sql` before deploying the UI. The LAN worker tolerates a missing migration and continues legacy imports, but identity correction stays unavailable until installation. No existing person is merged by this migration.

The staff-only panel in `/hosxp-review` searches by full CID, exact web person ID, or name. Staff explicitly selects the duplicate and canonical records, previews all screening histories and current values, and records a reason and same-person confirmation. Names are never used to automatically decide a merge.

The LAN worker verifies a unique HOSxP `person` and `patient` by the canonical CID, their shared HN and matching birth dates. It obtains the FIT importer's per-preparation locks and checks the local receipt ledger. The database rechecks the preview fingerprint under locks before applying a correction. Source rows with already imported FIT, Authen approvals, queued demographic changes, conflicting dates/results, different nonempty CIDs, or ambiguous identity are blocked. A reviewed correction transfers screening history and unimported preparations without inventing a new recorder, date, or approval. Other survey/demographic/household/VHV values remain those of the canonical record; original values are retained in the private correction audit.

The source population row is retained as an alias, cleared of current screening values and CID, hidden by an additional restrictive RLS policy, and rejects future writes. Existing village scope policies are unchanged. A linked canonical CID cannot be edited casually, new duplicate nonempty CIDs are rejected, and HOSxP mapping changes block FIT imports. No HOSxP record is changed by the correction worker itself; approved FIT imports remain a separate existing workflow.

Inspect status in the same panel. An expired or conflicting request is blocked, not silently reapproved. Transient failures stay pending. A lost completion acknowledgement is recovered from the committed correction job; existing identity-related retry caps are reset without resetting unrelated import failures. Requests expire after 24 hours.

Tests: `node tests/person-identity.cjs`, `node tests/hosxp-fit-lan.cjs`, `node tests/hosxp-fit-writer.cjs`, `node tests/hosxp-fit-auto.cjs`, and Next production build. No real patients are merged by tests.

This is identity linking and duplicate correction, not a general demographic synchronizer. Review historical/imported conflicts separately; do not delete HOSxP visits or alter screening dates to force a merge.
