import type { TransactionReceipt, TransactionResponse } from "ethers";
import { rpcError } from "../types";
export type TxPhase =
  | "idle"
  | "wallet"
  | "submitted"
  | "pending"
  | "unconfirmed"
  | "confirmed"
  | "failed"
  | "rejected";
export interface TxState {
  phase: TxPhase;
  label?: string;
  hash?: string;
  /** Block that included the confirmed transaction. */
  block?: number;
  error?: string;
}
export async function confirmTransaction(
  tx: TransactionResponse,
  onState: (phase: TxPhase, hash: string) => void,
): Promise<TransactionReceipt> {
  onState("submitted", tx.hash);
  onState("pending", tx.hash);
  let receipt;
  try {
    receipt = await tx.wait(1, 120_000);
  } catch (caught) {
    const error = rpcError(caught);
    if (
      error.code === "TRANSACTION_REPLACED" &&
      !error.cancelled &&
      error.reason === "repriced"
    )
      receipt = error.receipt;
    else if (
      error.code === "TRANSACTION_REPLACED" ||
      error.receipt?.status === 0 ||
      error.code === "CALL_EXCEPTION"
    )
      throw caught;
    else
      throw Object.assign(
        new Error(
          "The transaction was submitted, but its receipt could not be verified. Check confirmation before submitting another transaction.",
        ),
        { code: "RECEIPT_UNCONFIRMED" },
      );
  }
  if (!receipt)
    throw Object.assign(
      new Error(
        "No transaction receipt is available yet. Check confirmation before submitting another transaction.",
      ),
      { code: "RECEIPT_UNCONFIRMED" },
    );
  if (receipt.status !== 1)
    throw new Error(
      "Transaction failed or reverted. Check the transaction hash before retrying.",
    );
  onState("confirmed", receipt.hash);
  return receipt;
}
