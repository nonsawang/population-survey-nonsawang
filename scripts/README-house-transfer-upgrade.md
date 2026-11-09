# House transfer upgrade

Apply in this order during a maintenance window with transfer requests paused:

1. `20261109_house_transfer_requests.sql` (new installations only).
2. `20261109_house_transfer_hardening.sql` (existing and new installations).
3. `20261109_house_transfer_legacy.sql`.

Deploy the API and PendingTransfersBanner changes together. This updates the survey registry only; no HOSxP write is performed.

Legacy import preserves the original activity logs. Valid pending records appear in the queue with a review badge. They cannot be approved: staff must inspect current source/destination and submit a fresh request, which supersedes the imported request. No historical source version is inferred from current data.

Inspect all excluded or malformed records before retiring the old workflow:

```sql
SELECT disposition, count(*) FROM public.house_transfer_legacy_review GROUP BY disposition;
SELECT log_id, disposition FROM public.house_transfer_legacy_review WHERE request_id IS NULL ORDER BY log_id;
```

Repeated import does not duplicate requests. If multiple historical requests exist for one person, the newest eligible record is imported; others remain recorded for review. Correct excluded records by submitting a fresh request after human review, never by changing historical logs.

`node tests/house-transfer.cjs` uses PGlite and tests sequential transactions, permissions, village validation, stale source protection, VHV validation, pagination and legacy migration replay. It does not prove concurrent-session behavior. Before production rollout run simultaneous submit/approve/cancel on an isolated PostgreSQL instance; submit and approve now acquire the person lock before the request lock.
