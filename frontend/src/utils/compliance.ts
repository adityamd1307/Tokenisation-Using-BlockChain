export const countries = [
  { code: 702, name: "Singapore" },
  { code: 840, name: "United States" },
  { code: 356, name: "India" },
];
export const identityReasons = [
  "Valid",
  "Identity not registered",
  "Simulated KYC not approved",
  "Credential revoked",
  "KYC credential expired",
  "Credential attestor no longer trusted",
];
export function transferReason(code: number) {
  return (
    (
      {
        0: "Transfer allowed",
        1: "Sender identity invalid",
        2: "Recipient identity invalid",
        3: "Recipient jurisdiction not allowed",
        4: "Simulated accreditation required",
        5: "Recipient exceeds maximum wallet holdings",
        7: "Insufficient token balance",
        8: "Zero-address transfers are not allowed",
      } as Record<number, string>
    )[code] || "Transfer not permitted"
  );
}
