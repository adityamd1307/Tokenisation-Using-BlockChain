// Every custom error in the three compiled ABIs has a plain-English message,
// and undecodable or raw RPC errors never reach the user verbatim.
import { describe, expect, it } from "vitest";
import { Interface, parseEther, ZeroHash, type ErrorFragment } from "ethers";
import { abis } from "../config/contracts";
import { errorMessage, messages } from "../utils/errors";
import { INVESTOR } from "./fixtures";

const fragments = Object.values(abis).flatMap((abi) =>
  new Interface(abi).fragments.filter(
    (f): f is ErrorFragment => f.type === "error",
  ),
);
const sample = (type: string) =>
  type === "address" ? INVESTOR : type === "bytes32" ? ZeroHash : 7n;

describe("Revert decoding", () => {
  it.each([...new Set(fragments.map((f) => f.name))])(
    "maps %s to plain English",
    (name) => {
      const fragment = fragments.find((f) => f.name === name)!;
      expect(messages[name]).toBeDefined();
      const data = new Interface([fragment]).encodeErrorResult(
        fragment,
        fragment.inputs.map((input) => sample(input.type)),
      );
      const message = errorMessage({ code: "CALL_EXCEPTION", data });
      expect(message).not.toContain(name);
      expect(message).not.toMatch(/0x[0-9a-f]{8,}/i);
      expect(message).toMatch(/^[A-Z“"]/);
    },
  );
  it("uses error arguments in the message", () => {
    const iface = new Interface(abis.sale);
    const data = iface.encodeErrorResult("IncorrectPayment", [
      parseEther("0.1"),
      parseEther("0.05"),
    ]);
    expect(errorMessage({ code: "CALL_EXCEPTION", data })).toBe(
      "The payment must be exactly 0.1 ETH, but 0.05 ETH was sent. Refresh and try again.",
    );
  });
  it("reads revert data nested in a wallet error", () => {
    const data = new Interface(abis.token).encodeErrorResult(
      "RecipientNotWhitelisted",
      [INVESTOR],
    );
    expect(
      errorMessage({ code: -32603, info: { error: { data: { data } } } }),
    ).toBe("Recipient 0x3000…0003 is not a verified investor in this fund.");
  });
  it.each([
    [{ code: "CALL_EXCEPTION", data: "0xdeadbeef" }],
    [{ code: "UNKNOWN_ERROR", message: '{"jsonrpc":"2.0","error":{}}' }],
    [{ code: "BAD_DATA", message: "could not coalesce error (error={...})" }],
    [new Error("execution reverted at Object.call (node:internal/x:1:2)")],
  ])("never shows raw RPC text (%#)", (error) => {
    const message = errorMessage(error);
    expect(message).not.toMatch(/[{}]|jsonrpc|coalesce|node:internal/);
  });
  it("keeps readable pre-flight messages", () => {
    expect(errorMessage(new Error("Insufficient token balance."))).toBe(
      "Insufficient token balance.",
    );
  });
});
