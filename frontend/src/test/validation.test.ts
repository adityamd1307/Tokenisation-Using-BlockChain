import { describe, expect, it } from "vitest";
import { MaxUint256, parseEther } from "ethers";
import {
  address,
  creationArgs,
  payment,
  priceWei,
  quantity,
} from "../utils/validation";
import { INVESTOR } from "./fixtures";
describe("Exact blockchain input validation", () => {
  it("calculates 100 CPT × 0.001 ETH as exactly 0.1 ETH in wei", () =>
    expect(payment(quantity("100"), priceWei("0.001"))).toBe(
      parseEther("0.1"),
    ));
  it("preserves quantities above JavaScript’s safe integer limit", () =>
    expect(quantity("9007199254740993")).toBe(9007199254740993n));
  it.each([
    "",
    "0",
    "-1",
    "1.2",
    "1e3",
    "NaN",
    "Infinity",
    `${MaxUint256 + 1n}`,
  ])("rejects invalid whole quantity %s", (value) =>
    expect(() => quantity(value)).toThrow(),
  );
  it.each(["", "0", "-0.1", "1e-3", ".001", "0.0000000000000000001"])(
    "rejects invalid ETH price %s",
    (value) => expect(() => priceWei(value)).toThrow(),
  );
  it("rejects payment overflow", () =>
    expect(() => payment(MaxUint256, 2n)).toThrow());
  it("validates and trims addresses", () =>
    expect(address(` ${INVESTOR} `)).toBe(INVESTOR));
  it.each(["0x0", "0x0000000000000000000000000000000000000000", "user.eth"])(
    "rejects unsupported address %s",
    (value) => expect(() => address(value)).toThrow(),
  );
  it("maps creation fields to the real six-argument ABI and permits optional descriptions", () =>
    expect(
      creationArgs({
        name: " CPT ",
        symbol: " CPT ",
        description: "",
        category: "0",
        supply: "10000",
        price: "0.001",
      }),
    ).toEqual(["CPT", "CPT", "", 0, 10000n, parseEther("0.001")]));
});
