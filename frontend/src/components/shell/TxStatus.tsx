import {
  CircleCheck,
  CircleX,
  LoaderCircle,
  TriangleAlert,
  X,
} from "lucide-react";
import { useTransaction } from "../../context/TransactionContext";
import type { TxPhase } from "../../services/transactions";
import { Address } from "../ui/display";

// One shared status for every write call:
// awaiting signature -> pending (hash) -> confirmed (block) or failed (decoded reason).
const steps = ["Signature", "Pending", "Confirmed"] as const;
function stepState(phase: TxPhase, index: number, hasHash: boolean) {
  const current =
    phase === "wallet"
      ? 0
      : ["submitted", "pending", "unconfirmed"].includes(phase)
        ? 1
        : phase === "confirmed"
          ? 3
          : hasHash
            ? 1
            : 0;
  if (["failed", "rejected"].includes(phase) && index === current)
    return "failed";
  if (index < current) return "done";
  if (index === current) return "current";
  return "";
}

const headline: Record<Exclude<TxPhase, "idle">, string> = {
  wallet: "Awaiting signature",
  submitted: "Pending",
  pending: "Pending",
  unconfirmed: "Not yet verified",
  confirmed: "Confirmed",
  failed: "Failed",
  rejected: "Rejected in wallet",
};

export function TxStatus() {
  const { state, checkConfirmation, dismiss } = useTransaction();
  if (state.phase === "idle") return null;
  const phase = state.phase;
  const tone =
    phase === "confirmed"
      ? "ok"
      : phase === "failed" || phase === "rejected"
        ? "err"
        : "pending";
  const Icon =
    phase === "confirmed"
      ? CircleCheck
      : phase === "failed" || phase === "rejected"
        ? CircleX
        : phase === "unconfirmed"
          ? TriangleAlert
          : LoaderCircle;
  const finished = ["confirmed", "failed", "rejected"].includes(phase);
  return (
    <div className="tx-region">
      <section
        className={`tx tx--${tone}`}
        role={tone === "err" ? "alert" : "status"}
        aria-live={tone === "err" ? "assertive" : "polite"}
        aria-label="Transaction status"
      >
        <div className="tx__header">
          <Icon
            aria-hidden
            className={
              tone === "pending" && phase !== "unconfirmed" ? "spin" : undefined
            }
          />
          <p className="tx__title">
            {state.label}: {headline[phase]}
          </p>
          {finished && (
            <button
              type="button"
              className="icon-btn"
              onClick={dismiss}
              aria-label="Dismiss transaction status"
            >
              <X aria-hidden />
            </button>
          )}
        </div>
        <div className="tx__body">
          <ol className="tx__steps" aria-hidden>
            {steps.map((step, index) => {
              const s = stepState(phase, index, !!state.hash);
              return (
                <li
                  key={step}
                  className={`tx__step${s ? ` tx__step--${s}` : ""}`}
                >
                  {step}
                </li>
              );
            })}
          </ol>
          {phase === "wallet" && (
            <p>Review and sign the transaction in your wallet.</p>
          )}
          {(phase === "submitted" || phase === "pending") && (
            <p>Submitted. Waiting for the network to include it in a block.</p>
          )}
          {phase === "confirmed" && (
            <p>
              Confirmed
              {state.block !== undefined
                ? ` in block ${state.block.toLocaleString("en-US")}`
                : ""}
              .
            </p>
          )}
          {state.error && <p>{state.error}</p>}
          {state.hash && (
            <p className="row">
              Transaction <Address value={state.hash} kind="tx" />
            </p>
          )}
          {phase === "unconfirmed" && (
            <div>
              <button
                className="btn btn--secondary btn--sm"
                onClick={() => void checkConfirmation()}
              >
                Check confirmation
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
