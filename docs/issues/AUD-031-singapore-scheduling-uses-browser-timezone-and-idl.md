# AUD-031: Singapore scheduling uses browser timezone and idle chain time

| Field | Value |
|---|---|
| Status | Fixed in working tree; no commit requested |
| Severity | Medium (incorrect scheduling / stale time-dependent availability) |
| Category | Frontend timezone and local test infrastructure |
| Found by | User timing report, source inspection, UTC regression tests and local RPC timestamp measurement |
| Scope | Date rendering, offering/credential inputs, persistent demo mining, integration-test isolation |

## 1. Why the AI made the mistake

Date formatting omitted an explicit timezone, datetime-local inputs were parsed with `Date.parse`, and default/renewal values used the browser's `getTimezoneOffset`. These observable implementation choices assumed the browser timezone matched the project's intended Singapore timezone. Date.parse also silently normalized some invalid calendar dates. No hidden reasoning is inferred.

The demo node used transaction-only mining. On inspection at 15:20:59 UTC, its latest block was 09:38:08 UTC, approximately 5 hours 43 minutes behind. Contract `state()` and identity verification correctly reflected that old block, so frontend polling alone could not advance opening/closing/expiry. Integration tests also used the same port 8545 and deliberately advanced time, creating a separate risk of moving the demo ahead of wall time.

## 2. Why it is problematic

An input such as 08:00 on 1 January 2030 could be saved as 08:00 UTC in a UTC browser, instead of the intended 00:00 UTC (08:00 Singapore). Two users could see or enter different instants for the same apparent schedule. An idle chain could leave an offering apparently Upcoming or credentials valid after real-world deadlines, until another transaction mined a block. Changing just the displayed label would not fix either problem.

## 3. How we fixed it

- Added shared Singapore date formatting, strict calendar parsing and datetime-local serialization. Inputs without an offset use UTC+08:00; explicit ISO offsets remain unchanged. Credential renewal preserves seconds. Offering/default/credential/history displays use the same convention and label SGT.
- Added a live Singapore wall clock in the header. Financial and eligibility decisions still come from confirmed chain state; no contract timestamp is shifted by eight hours.
- Added a separate `localDemo` Hardhat network with automatic transactions and two-second interval mining; `npm run node` selects it. Deterministic isolated test networks keep their existing mining configuration.
- Added `npm run time:sync:local` to catch up an existing behind-clock Hardhat node and enable periodic mining without resetting contracts or balances. It refuses to move a future chain backward or reset it automatically.
- Changed the root integration command to start/stop an isolated node on its own port. Direct frontend integration runs default to separate port 18545 or an explicit INTEGRATION_RPC_URL, never demo port 8545.
- Updated setup and manual tests, including disabling both interval and automatic mining when testing a pending receipt.

Existing immutable offering schedules and stored credential expiries retain their original Unix values. Old incorrectly entered offering parameters are not rewritten. Catching up the chain may correctly make an old offering closed or a credential expired.

## 4. Evidence the fix works

Evidence lives in `docs/evidence/time/`:

- `before.log`: all three behavioral regressions fail in a UTC environment before the fix: naive input instant, Singapore display and invalid calendar date.
- `frontend.log`: all **301 frontend tests pass** under `TZ=UTC`, including seven time/credential-encoding tests.
- `los-angeles.log`: the seven timezone tests also pass under `TZ=America/Los_Angeles`.
- `contracts.log`: **240 contract/script tests pass**; financial contracts were not changed.
- `integration.log`: **three real-chain suites pass** on the isolated node, including explicit ISO dates.
- `build.log`, `types.log`, `lint.log`: production build, root TypeScript and frontend lint pass.
- `local-sync.log`: previously idle demo caught up to wall time with zero measured drift; two-second mining enabled.
- `live-clock.json`: after integration testing, demo still matches wall time and both factory runtime/deployment-block fingerprints remain unchanged.
- `idle-mining.json`: a newly created localDemo network mines blocks while idle and tracks wall time within three seconds.

The first full frontend validation encountered missing dependencies from the updated branch. Installing the existing frontend lockfile resolved the environment; no package versions or lockfile changes were required. The later passing logs are the final results. No manual MetaMask/visual acceptance or independent audit is claimed for this change.
