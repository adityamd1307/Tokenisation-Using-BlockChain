# Coverage and gas — measured Phase 6

`npx hardhat test --coverage`: exit 0, 153 passing contract/script tests. Native Hardhat coverage reports:

| Source | Lines | Statements |
|---|---:|---:|
| AssetToken | 100% | 100% |
| AssetFactory | 100% | 100% |
| AssetSale | 100% | 100% |
| All contracts including four helper files | 99.25% | 99.37% |

The only uncovered line is AssetSaleIssuerHarness.sol:38, which marks recursive withdrawal as successful; correct accounting makes that attack fail. Coverage does not report branch coverage in this table. No frontend coverage measurement was run. Generated HTML stays in ignored `coverage/html`; durable text is `logs/final-coverage.log`.

`npx hardhat test --gas-stats`: exit 0, 153 passing. In the instrumented suite: factory deployment 2,973,114 gas; createAsset range 1,925,522–2,013,385; allocate 62,207–65,084; buyTokens 55,057–89,269; withdrawProceeds 29,586; closeSale 44,374; recoverUnsoldTokens 43,174. These are fixture-dependent measurements, not fixed network prices. Exact demo receipts additionally record gas and fees in `final-demo.json`.

Production runtime bytecode is unchanged from baseline: AssetFactory 13,545 bytes, AssetToken 4,124, AssetSale 3,132. The 24,576-byte EIP-170 limit is not approached by the optimized current builds. Both default and production profiles compile with optimizer 200. No Phase 6 Solidity optimization was implemented or gas savings claimed. Existing factory metadata storage supports the registry; removing it would change the API. Additional signer deployment reads deliberately trade a little RPC latency for correctness. Bulk history/registry pagination may be future work, not silently added now.
