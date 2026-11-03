import { useTransaction } from "../context/TransactionContext";
import { Address } from "./common";
const labels = {
  idle: "",
  wallet: "Awaiting wallet confirmation",
  submitted: "Submitted to network",
  pending: "Pending confirmation",
  unconfirmed: "Confirmation not yet verified",
  confirmed: "Confirmed successfully",
  failed: "Failed or reverted",
  rejected: "Rejected by user",
};
export function TransactionStatus() {
  const { state, checkConfirmation } = useTransaction();
  if (state.phase === "idle") return null;
  return (
    <div
      className={`transaction-status notice ${state.phase === "confirmed" ? "success" : ["failed", "rejected"].includes(state.phase) ? "error" : "info"}`}
      role={state.phase === "failed" ? "alert" : "status"}
    >
      <div>
        <strong>
          {state.label} · {labels[state.phase]}
        </strong>
        {state.error && <p>{state.error}</p>}
        {state.hash && (
          <div className="transaction-hash">
            Transaction <Address value={state.hash} full />
          </div>
        )}
        {state.phase === "unconfirmed" && (
          <button
            className="button secondary"
            onClick={() => void checkConfirmation()}
          >
            Check confirmation
          </button>
        )}
      </div>
    </div>
  );
}
