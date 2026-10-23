# Tokenisation Using Blockchain

Phase 2 implements a fixed-supply ERC-20 asset token with role-based investor
eligibility. Factory, sale and frontend functionality remain for later phases.

With the locked dependencies installed (`npm ci` on a fresh checkout):

```bash
npm run compile
npm test
npx hardhat test mocha test/AssetToken.test.ts --grep "local demonstration"
```

Use a Node.js version supported by the installed Hardhat 3 release (validation
used Node 22.18.0). Tests run against a local simulated chain without a wallet,
testnet credentials or real ETH. A fresh installation may need internet access
to download dependencies and the Solidity compiler; test execution uses no live
chain. Factory/sale tests are pending placeholders, not completed validation.

See [Phase 2 implementation and test results](docs/phase2-implementation.md),
[the Phase 2 requirements](docs/spec/phase2-requirements.md), and
[audit evidence](docs/evidence/phase2/README.md).
