# Identity Registry Lite

Authority: [specification A](erc3643-lite-specification.md), implementing Enhancement C §3. Every newly regulated asset receives a separate registry. An investor can therefore be registered for one asset without being registered for another.

## Credential lifecycle

`IdentityData` contains an opaque `bytes32 identityId`, ISO numeric `uint16 country`, simulated KYC/accreditation booleans and a `uint64 validUntil`. The stored record also contains `attestedBy` and `revoked`. There are no names, passport numbers, documents, identity URLs or signed personal claims. IDs must be random synthetic values; this cannot be enforced against arbitrary bytes supplied by a trusted attestor. Public country/eligibility metadata still has privacy implications and is synthetic in this demo.

| Function | Authority | Result |
|---|---|---|
| `registerIdentity` | Trusted attestor | New, nonzero investor and ID; supported country; future expiry; rejects an existing record and self-attestation |
| `updateIdentity` | Trusted attestor | Existing record, same opaque ID, replacement attributes and issuing attestor; clears revocation; rejects self-attestation |
| `revokeIdentity` | Registry administrator or trusted attestor | Keeps all attributes and balances; marks the credential revoked |
| `grantRole` / `revokeRole` | Role administrator | Adds/removes trusted attestors; generic AccessControl administration remains available |
| `identity` | Public | Non-sensitive synthetic metadata |
| `identityStatus` / `isVerified` | Public | Current verification using chain time and current role membership |

Admin and attestor permissions are separate. Creating a registry grants only `DEFAULT_ADMIN_ROLE` to the platform administrator. Issuer authorization never grants attestation rights. The original registry administrator cannot revoke or renounce its own administrative role; it can delegate administration to other addresses. Those delegates are trusted to manage attestors too. A trusted attestor may revoke any registry credential; it is not restricted to its own records. No one may attest their own wallet, including an administrator who also holds the attestor role. Colluding wallets and dishonest attestors remain outside what simulated KYC can prove.

Verification status codes: `0 valid`, `1 unregistered`, `2 KYC not approved`, `3 revoked`, `4 expired`, `5 untrusted attestor`. The first failing condition in that order is reported. Expiry is exclusive: `block.timestamp < validUntil`. Accreditation and country eligibility are deliberately absent from identity verification.

Attestor removal invalidates its credentials immediately without enumeration. Regranting trust reactivates its still-live, non-revoked credentials; alternatively another trusted attestor can update the record. This reversible role policy is not a permanent issuer blacklist. Expired/revoked credentials can be renewed without changing identity IDs. No background job is required.

## Supported countries and limitations

The demo supports exactly Singapore **702**, United States **840** and India **356**, using ISO numeric codes. Other ISO countries are unsupported in this MVP; a non-supported value does not imply the country is fictitious. Country selection is simulated attestor input, never inferred from the wallet address. Jurisdiction restrictions are arbitrary asset policies, not legal advice.

One record per wallet does not establish one wallet per person. Shared IDs are not prevented, and per-wallet caps do not resist identity splitting. This is on-chain role-authorized mock attestation, not ONCHAINID, signed-claim verification, real KYC or an accreditation determination.

Events: `IdentityRegistered`, `IdentityUpdated`, `IdentityRevoked`, `TrustedAttestorAdded`, `TrustedAttestorRemoved`, plus standard AccessControl role events. All transfer-time checks use bounded mapping reads.
