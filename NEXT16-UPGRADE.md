# Next.js 16 upgrade — staged, not deployed

Prepared from production repository commit `f0aa20d` (person identity feature committed).
The source repository and Windows LAN scheduler were not modified. This directory is
an isolated snapshot, with its own `upgrade/next16` branch and no copied `.env` files.
Its Git history is independent; use the supplied patch in the original repository.

## Changes

- Next.js 16.3.6, React/React DOM 19.3.0, React Leaflet 5.0.0, Node 24.x.
- Await session cookies and catch-all route params, including logout and the
  implicit session lookup in `currentUser()`.
- Keep existing CSRF, no-store, session and database role policies.
- Preview builds and server database access require an explicitly configured
  separate Supabase project; the known production project is rejected.
- Update auth tests for async request APIs and initialized SWC bindings.
- No database migration or change to LAN writer scripts in this upgrade.

## Verification

Production build succeeded using Turbopack and dummy loopback Supabase settings.
Auth/role tests, four screening result/date round trips, identity reconciliation,
FIT/Authen/finance workflow fixture tests were run locally without production data.
`tests/next-runtime.cjs` starts the actual built Next server and a loopback database
stub, verifies pages, login, cookies, session, data API, no-store, CSRF and logout.
This is HTTP/runtime coverage, not an interactive browser or real LINE login test.

For an offline build and runtime test in PowerShell:

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL='http://127.0.0.1:54321'
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY='offline-build-fixture-not-a-real-key'
$env:NEXT_TELEMETRY_DISABLED='1'
npm ci
npm run build
node tests/next-runtime.cjs
```

Port 54321 must be free: the stub listens there because NEXT_PUBLIC settings are
embedded at build time. Do not reuse this build for deployment. It contains dummy
public configuration. Preview must be rebuilt with its own test-project settings.

## Before Vercel Preview

1. Create/use a separate Supabase test project. Apply the application's migrations
   in their documented order, checking prerequisites; do not copy patient data or
   production session/password records. Create synthetic staff/VHV test accounts.
2. In Vercel's **Preview** environment only, configure that project's
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, and `PREVIEW_SUPABASE_PROJECT_REF` (20-letter ref).
   Remove inherited production keys for Preview. Never commit keys.
3. No LAN worker must subscribe to the test project. Do not copy `.env.sync` or
   `lan-runtime` into this snapshot. No production scheduler changes are needed.
4. Test staff and VHV access, four screening types (save/reopen dates/results),
   search, map markers/boundaries, Authen report upload/approval with synthetic
   records, and LINE using a test channel/callback configuration.
5. Verify both test and production queue counts to confirm separation, without
   approving or importing real records as part of framework testing.

The Preview guard checks the configured project identity; it does not create a
test database or validate that all migrations/test fixtures have been installed.

## Apply and release

In the original repository, make a separate upgrade branch from `f0aa20d` or review
changes since that commit. Run `git apply --check` against `next16-upgrade.patch`,
then apply it. The patch changes framework/auth compatibility and adds test guards;
do not merge unrelated data migrations into this release.

Before release, record the actual current production deployment URL/commit and
Node/runtime environment settings. `f0aa20d` is the local source checkpoint, not a
verified Vercel deployment identifier. Complete Preview browser acceptance first.
Promote only a properly configured production build; never promote a Preview
artifact containing test Supabase public settings. Roll back the web deployment
if needed; deployment rollback does not roll back database data or migrations.

Pending: separate test database, Preview deploy, interactive map/LINE/mobile
acceptance, and production deployment. Nothing has been deployed by this upgrade.
