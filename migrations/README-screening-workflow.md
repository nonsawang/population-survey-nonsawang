# Screening history and review

Apply `20260911_screening_workflow.sql` once after the authentication and screening search migrations, before deploying the UI. It was applied to the configured Supabase project in this task. Do not rerun: it creates the tables and captures a one-time baseline.

The population trigger records changed screening result/date pairs in the same transaction as the latest values. An unchanged retry does not create another history event. Existing values are labeled baseline, with unknown original recorder/time. History records capture the actor from the server session; clients cannot insert, modify or delete history. History reads follow the current population RLS village scope.

The overview groups current eligible population by village and assigned `population.vhv` name, including unassigned people. It is independent of the search term and counts current results rather than number of historical visits.

Screening approvals are separate from demographic HOSxP approvals. They are immutable-event reviews by staff/admin and currently stop at `awaiting_mapping`. No transport/export process should consume these as approved demographic updates.

Pending HOSxP integration: HBV/HCV and FIT require a visit per the user. Confirm whether to reuse an existing visit or open a new one, patient/visit identifiers, lab/order/result table and code mappings, units and result values, and HPV/child workflow. Before enabling writes, implement duplicate-visit checks, target snapshot comparison, stale-approval detection, idempotent event delivery and acknowledgement. Do not infer these clinical mappings from residency/discharge exports.

Validation: `node tests/screening-workflow.cjs` with @electric-sql/pglite installed; Next production build.
