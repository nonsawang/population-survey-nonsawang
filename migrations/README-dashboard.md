# Dashboard aggregate rollout
1. Install migrations/20261002_dashboard_summary.sql before deploying the new Dashboard. This is additive; the old client continues to work.
2. The RPC is SECURITY INVOKER and uses population RLS, including identity alias restrictions. Do not change it to SECURITY DEFINER or call it with a service-role client.
3. Run tests/dashboard-summary.cjs (PGlite) to compare aggregates against the prior JavaScript formulas for anonymous, VHV and staff scope. Tests compare group content independent of ordering of blank/invalid village values.
4. Deploy the Dashboard, adapter and data RPC allowlists together. There is no raw-row fallback if the RPC is missing.
5. Verify staff/VHV totals, response size and query latency in production before claiming a speed improvement. Browser-local calendar calculations now consistently use Asia/Bangkok at the database.

The chronic counter intentionally preserves the prior count of disease entries, not unique people. KPI counting semantics and title-based gender inference are preserved. Changing those definitions is separate work.
