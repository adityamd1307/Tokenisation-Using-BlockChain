# Subscription enhancement session (curated)

Date: 7 November 2026, Asia/Singapore. Tool: Codex; model identifier not recorded here. This is a curated factual summary, not a verbatim transcript or hidden reasoning log. Exact user request: [subscription-requirements.md](../spec/subscription-requirements.md).

The preceding scope review compared the supplied course PDF with an earlier checkout. The user confirmed coordinator approval without additional requirements. The later request explicitly authorised full implementation of a subscription offering engine, tests, security review, UI integration and documentation while preserving direct sales, avoiding commits and avoiding mainnet.

At enhancement start the actual checkout had 142 contract tests and 118 frontend tests, with no assembled AI Audit Report. Earlier 153/122 counts belonged to a different checkout and were not used as this baseline. The original three contracts and historical evidence were preserved.

Decisions: separate subscription registry; trusted owner-minted six-decimal MockUSD; fixed zero-decimal asset units; future start; hard cap derived from supply × price; positive price-multiple commitments with oversubscription; conservative rounded-net soft-cap guarantee; O(1) permissionless finalisation; per-investor accounting settlement; independent owner-only refunds/claims; no claim expiry; safe inventory reserve; optional permissionless settleFor without payout redirection; local-only setup script; existing React design/contexts.

Observed errors retained in evidence: unsupported generic revert matcher; next-timestamp test without a mined block; non-virtual production hook in a generated test harness; JSX and TypeChain errors; extra legacy registry read; stale compiler artifact during Slither; empty no-compile coverage run. Corrections and first failure logs are linked in the security/testing documents. An empty history-page cursor was corrected during source review. No exploit, screenshot or independent human review was invented.

Executed final results: 194 contract tests, 131 frontend tests, two local-chain integration tests; build/typechecks, instrumented coverage, gas output, static analysis and successful/failed local demonstration. User later instructed to continue the last steps; work proceeded through final documentation and verification.

Browser setup returned “No browser is available”; documented discovery returned `[]`. Real MetaMask, desktop/mobile visual review and public-chain execution remain unverified. No subagents were used, no Git commits were made and no mainnet transactions were sent. Testnet/mainnet keys, seed phrases and .env contents were not read.
