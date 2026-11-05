import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
afterEach(cleanup);
// AUD-015: unit tests run against a fixed local test deployment, never the committed
// addresses.json, which points at whichever network was deployed last (Sepolia under D18).
// These are the local values the suite was written against.
vi.mock("../config/contracts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../config/contracts")>();
  return {
    ...actual,
    deployment: {
      chainId: 31337,
      AssetFactory: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
      deployBlock: 1,
      deployBlockHash:
        "0xa125c2ef6aa6e14ba479aec0166d8ea2587209ff86abfcbd40c88504bc1e7bab",
      runtimeCodeHash:
        "0xd7dc55949bf55916497fc396bacaf8e0f99e6b26794176d018c1be37ceebdf6b",
    },
  };
});
HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute("open", "");
};
HTMLDialogElement.prototype.close = function () {
  this.removeAttribute("open");
};
