import { describe, expect, it } from "vitest";
import { offeringArgs } from "../utils/subscription";
import { formatTime } from "../utils/formatting";

describe("Singapore scheduling independent of browser timezone", () => {
  it("interprets a timezone-free form value as Singapore time", () => {
    const args = offeringArgs(
      {
        supply: "1000",
        price: "2",
        softCap: "1200",
        start: "2030-01-01T08:00",
        end: "2030-01-01T09:00",
      },
      0n,
    );
    expect(args[3]).toBe(BigInt(Date.parse("2030-01-01T00:00:00Z") / 1000));
    expect(args[4] - args[3]).toBe(3600n);
  });
  it("shows historical timestamps in Singapore with a timezone label", () => {
    const formatted = formatTime(Date.parse("2026-11-07T10:00:00Z") / 1000);
    expect(formatted).toContain("18:00");
    expect(formatted).toContain("SGT");
  });
  it("rejects calendar dates that JavaScript would silently normalize", () => {
    expect(() =>
      offeringArgs(
        {
          supply: "10",
          price: "2",
          softCap: "10",
          start: "2030-02-30T08:00",
          end: "2030-03-03T08:00",
        },
        0n,
      ),
    ).toThrow();
  });
});

import {
  futureSingaporeInput,
  parseSingaporeDateTime,
  singaporeDateTimeInput,
} from "../utils/time";
import { Compliance } from "../services/compliance";
import type { Blockchain } from "../services/blockchain";
import { vi } from "vitest";
import {
  asset,
  INVESTOR,
  ISSUER,
  SALE,
  MockWallet,
  mockTransaction,
} from "./fixtures";

describe("Singapore time round trips and service encoding", () => {
  it("preserves explicit UTC and offset service timestamps", () => {
    const instant = Date.parse("2030-01-01T00:00:12Z");
    expect(parseSingaporeDateTime("2030-01-01T00:00:12Z")).toBe(instant);
    expect(parseSingaporeDateTime("2030-01-01T08:00:12+08:00")).toBe(instant);
    expect(parseSingaporeDateTime("2029-12-31T16:00:12-08:00")).toBe(instant);
  });
  it("crosses UTC midnight and preserves credential seconds on reload", () => {
    const instant = Date.parse("2026-11-07T16:01:37Z");
    expect(singaporeDateTimeInput(instant, true)).toBe("2026-11-08T00:01:37");
    expect(parseSingaporeDateTime(singaporeDateTimeInput(instant, true))).toBe(
      instant,
    );
    expect(futureSingaporeInput(5, Date.parse("2026-11-07T15:58:00Z"))).toBe(
      "2026-11-08T00:03",
    );
  });
  it("rejects invalid calendar/time fields and accepts leap days", () => {
    for (const invalid of [
      "2030-02-29T08:00",
      "2030-13-01T08:00",
      "2030-01-01T24:00",
      "2030-01-01T08:60",
      "2030-01-01",
      "",
    ]) {
      expect(Number.isNaN(parseSingaporeDateTime(invalid))).toBe(true);
    }
    expect(parseSingaporeDateTime("2028-02-29T08:00")).toBe(
      Date.parse("2028-02-29T00:00:00Z"),
    );
  });
  it("sends credential expiry in Unix seconds for the selected Singapore instant", async () => {
    const submit = vi.fn().mockResolvedValue(mockTransaction());
    const api = {
      provider: {
        getBlock: vi.fn().mockResolvedValue({ timestamp: 1800000000 }),
      },
      signer: vi.fn().mockResolvedValue({}),
    } as unknown as Blockchain;
    const service = new Compliance(api);
    vi.spyOn(service, "registry").mockReturnValue({
      connect: () => ({ registerIdentity: submit }),
    } as any);
    const identityId = `0x${"ab".repeat(32)}`;
    await service.attest(
      new MockWallet(),
      ISSUER,
      { ...asset, identityRegistry: SALE },
      INVESTOR,
      {
        identityId,
        country: "702",
        kycApproved: true,
        accredited: true,
        validUntil: "2030-01-01T08:00:37",
      },
      false,
    );
    expect(submit).toHaveBeenCalledWith(INVESTOR, [
      identityId,
      702,
      true,
      true,
      BigInt(Date.parse("2030-01-01T00:00:37Z") / 1000),
    ]);
  });
});
