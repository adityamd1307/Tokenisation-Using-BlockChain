# Slither results and triage

Slither 0.11.6 / crytic-compile 0.4.2 executed successfully against Hardhat 3.21.0 build artifacts. Final JSON has `success: true`; CLI exit **255** denotes findings, not failure to analyse. 22 contracts (including dependencies/test helpers), 102 detectors, 29 findings: 2 high, 4 medium, 7 low, 16 informational. The initial scan before the new helper had 23 findings. No confirmed exploitable production-contract vulnerability emerged from manual triage; this is not a claim of complete security.

## Reproduce

```bash
python3 -m venv /private/tmp/sc4053-slither
/private/tmp/sc4053-slither/bin/pip install --no-cache-dir slither-analyzer==0.11.6
npm run compile
VIRTUAL_ENV=/private/tmp/sc4053-slither /private/tmp/sc4053-slither/bin/slither . --hardhat-ignore-compile --filter-paths '' --json /private/tmp/slither-new-results.json
```

The existing config excludes test paths. This audit explicitly passes an empty filter to retain tests and dependencies. No detector was disabled. `slither-results.json` is the actual final tool output; `slither-triage.json` links every result to its original Slither ID. Keep a new output filename on reruns.

Initial setup evidence: sandbox pip failed DNS; retry installed in a temporary venv with network access. Invoking the venv executable without VIRTUAL_ENV attempted a forbidden global solc-select directory; setting VIRTUAL_ENV kept it local. An initial unsupported `--hardhat-skip-compile` argument was corrected to `--hardhat-ignore-compile`. These failed attempts remain in logs. Hardhat 3 artifacts were accepted by installed crytic-compile; no toolchain replacement or contract flattening was needed.

## Every final detector result

| ID | Detector / tool severity | Classification | Manual rationale |
|---|---|---|---|
| SL-001 | arbitrary-send-erc20 / High | False positive | allocate is onlyIssuer; from is the immutable issuer, destination is this sale, and issuer allowance is required. An unrelated caller cannot choose a victim. |
| SL-002 | unchecked-transfer / High | Informational finding | Test-only adversarial/holder harness, never constructed by the factory or deployment scripts. The intentionally permissive or receiving behavior enables negative tests; it is not a supported production contract. |
| SL-003 | incorrect-equality / Medium | False positive | Rejecting exactly zero inventory/excess is intentional. Any positive amount remains recoverable; donated tokens or forced ETH cannot make a positive balance fail this condition. |
| SL-004 | incorrect-equality / Medium | False positive | Rejecting exactly zero inventory/excess is intentional. Any positive amount remains recoverable; donated tokens or forced ETH cannot make a positive balance fail this condition. |
| SL-005 | locked-ether / Medium | Informational finding | Test-only adversarial/holder harness, never constructed by the factory or deployment scripts. The intentionally permissive or receiving behavior enables negative tests; it is not a supported production contract. |
| SL-006 | locked-ether / Medium | Informational finding | Test-only adversarial/holder harness, never constructed by the factory or deployment scripts. The intentionally permissive or receiving behavior enables negative tests; it is not a supported production contract. |
| SL-007 | missing-zero-check / Low | Informational finding | Test-only adversarial/holder harness, never constructed by the factory or deployment scripts. The intentionally permissive or receiving behavior enables negative tests; it is not a supported production contract. |
| SL-008 | missing-zero-check / Low | Informational finding | Test-only adversarial/holder harness, never constructed by the factory or deployment scripts. The intentionally permissive or receiving behavior enables negative tests; it is not a supported production contract. |
| SL-009 | reentrancy-benign / Low | Informational finding | Test-only adversarial/holder harness, never constructed by the factory or deployment scripts. The intentionally permissive or receiving behavior enables negative tests; it is not a supported production contract. |
| SL-010 | reentrancy-benign / Low | Informational finding | Test-only adversarial/holder harness, never constructed by the factory or deployment scripts. The intentionally permissive or receiving behavior enables negative tests; it is not a supported production contract. |
| SL-011 | reentrancy-benign / Low | Informational finding | Test-only adversarial/holder harness, never constructed by the factory or deployment scripts. The intentionally permissive or receiving behavior enables negative tests; it is not a supported production contract. |
| SL-012 | reentrancy-events / Low | Informational finding | Callback events may precede the outer payout event. Accounting is cleared before withdrawal and the EVM debits ETH before sweep callbacks. Existing recursive/rejecting and Phase 6 cross-function tests show no double payout. Event order is not interpreted as an accounting proof. |
| SL-013 | reentrancy-events / Low | Informational finding | Callback events may precede the outer payout event. Accounting is cleared before withdrawal and the EVM debits ETH before sweep callbacks. Existing recursive/rejecting and Phase 6 cross-function tests show no double payout. Event order is not interpreted as an accounting proof. |
| SL-014 | assembly / Informational | Informational finding | OpenZeppelin SafeERC20 return-value handling or test-helper revert bubbling. Owned production contracts contain no inline assembly. Not an unchecked production external call. |
| SL-015 | assembly / Informational | Informational finding | OpenZeppelin SafeERC20 return-value handling or test-helper revert bubbling. Owned production contracts contain no inline assembly. Not an unchecked production external call. |
| SL-016 | assembly / Informational | Informational finding | OpenZeppelin SafeERC20 return-value handling or test-helper revert bubbling. Owned production contracts contain no inline assembly. Not an unchecked production external call. |
| SL-017 | assembly / Informational | Informational finding | OpenZeppelin SafeERC20 return-value handling or test-helper revert bubbling. Owned production contracts contain no inline assembly. Not an unchecked production external call. |
| SL-018 | assembly / Informational | Informational finding | OpenZeppelin SafeERC20 return-value handling or test-helper revert bubbling. Owned production contracts contain no inline assembly. Not an unchecked production external call. |
| SL-019 | pragma / Informational | Informational finding | Ranges in dependency source are not the selected compiler. Both profiles pin 0.8.24. Additional current compiler advisories are separately reviewed in dependency-review.md; scanner version warnings alone do not establish exploitability. |
| SL-020 | solc-version / Informational | Informational finding | Ranges in dependency source are not the selected compiler. Both profiles pin 0.8.24. Additional current compiler advisories are separately reviewed in dependency-review.md; scanner version warnings alone do not establish exploitability. |
| SL-021 | solc-version / Informational | Informational finding | Ranges in dependency source are not the selected compiler. Both profiles pin 0.8.24. Additional current compiler advisories are separately reviewed in dependency-review.md; scanner version warnings alone do not establish exploitability. |
| SL-022 | solc-version / Informational | Informational finding | Ranges in dependency source are not the selected compiler. Both profiles pin 0.8.24. Additional current compiler advisories are separately reviewed in dependency-review.md; scanner version warnings alone do not establish exploitability. |
| SL-023 | solc-version / Informational | Informational finding | Ranges in dependency source are not the selected compiler. Both profiles pin 0.8.24. Additional current compiler advisories are separately reviewed in dependency-review.md; scanner version warnings alone do not establish exploitability. |
| SL-024 | low-level-calls / Informational | Informational finding | Production calls pay the immutable issuer and check success; test helpers deliberately forward calls and bubble reverts. No user-controlled delegatecall exists. |
| SL-025 | low-level-calls / Informational | Informational finding | Production calls pay the immutable issuer and check success; test helpers deliberately forward calls and bubble reverts. No user-controlled delegatecall exists. |
| SL-026 | low-level-calls / Informational | Informational finding | Production calls pay the immutable issuer and check success; test helpers deliberately forward calls and bubble reverts. No user-controlled delegatecall exists. |
| SL-027 | low-level-calls / Informational | Informational finding | Production calls pay the immutable issuer and check success; test helpers deliberately forward calls and bubble reverts. No user-controlled delegatecall exists. |
| SL-028 | unindexed-event-address / Informational | Informational finding | Inherited OpenZeppelin pause events are valid; lack of indexed address affects filtering convenience, not permissions or settlement. |
| SL-029 | unindexed-event-address / Informational | Informational finding | Inherited OpenZeppelin pause events are valid; lack of indexed address affects filtering convenience, not permissions or settlement. |
