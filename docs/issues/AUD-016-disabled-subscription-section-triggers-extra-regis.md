# AUD-016: Disabled subscription section triggers extra registry reads

Status: fixed in the working tree; no commits requested. Severity: low. Category: frontend compatibility. Discovered and corrected during the subscription enhancement, 7 November 2026. This issue was documented after the correction using the retained failing and passing logs; no retrospective test/fix commits are claimed.

## Why AI made the mistake

The first generated SubscriptionOfferings component invoked useAssets before returning when subscriptions.enabled was false. Hooks execute before that return. The extra subscription section therefore registered another asset-reader even for legacy-only deployments. This is the observable implementation error; no hidden model reasoning is asserted.

## Why it is problematic

An unused optional feature made additional registry requests and broke the existing marketplace RPC-error/retry test. The extra reader consumed the mocked first failure and exposed different UI state. Extra requests also add latency and rate-limit pressure to deployments that have not enabled subscriptions. No funds or contract permissions were affected.

## How it was fixed

SubscriptionOfferings now checks deployment availability in a small wrapper. The separate EnabledSubscriptionOfferings child owns all reads and polling, and only mounts when the extension is configured. Existing asset behaviour remains unchanged.

## Evidence the fix works

- Before: `../evidence/subscription/frontend-compatibility.log` records 117 passing and one failing test, the existing UI test for displaying an RPC failure and retrying.
- After: `../evidence/subscription/frontend-compatibility-after.log` records all 118 baseline frontend tests passing.
- Expanded final suite: `../evidence/subscription/frontend-tests-final.log` records 131 passing tests, including new subscription flows.
- Production build and real-chain service integration also pass, with their own evidence files.

The existing regression test exposed the issue; no duplicate implementation-mirroring test was added solely to increase test count. Tests/patches were not committed because the user expressly prohibited commits.
