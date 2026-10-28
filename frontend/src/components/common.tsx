import { useEffect, useRef, useState, type ReactNode } from "react";
import { shortAddress } from "../utils/formatting";

export function Address({
  value,
  full = false,
}: {
  value: string;
  full?: boolean;
}) {
  const [copied, setCopied] = useState(false),
    [failed, setFailed] = useState(false);
  return (
    <span className="address-wrap">
      <code title={value}>{full ? value : shortAddress(value)}</code>
      <button
        className="copy-button"
        type="button"
        aria-label={`Copy ${value}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setFailed(false);
          } catch {
            setFailed(true);
          }
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
      {failed && <small>Select and copy: {value}</small>}
    </span>
  );
}
export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">◇</div>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}
export function Loading({
  children = "Loading blockchain data…",
}: {
  children?: ReactNode;
}) {
  return (
    <div role="status" className="loading">
      <span className="spinner" />
      {children}
    </div>
  );
}
export function ErrorMessage({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div role="alert" className="notice error">
      <span>{message}</span>
      {retry && (
        <button className="button secondary small" onClick={retry}>
          Retry
        </button>
      )}
    </div>
  );
}
export function PageHeader({
  eyebrow,
  title,
  children,
  action,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-description">{children}</p>
      </div>
      {action}
    </header>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Status({ closed }: { closed: boolean }) {
  return (
    <span className={`badge ${closed ? "neutral" : "positive"}`}>
      <span className="dot" />
      {closed ? "Closed" : "Active offering"}
    </span>
  );
}
export function ConfirmDialog({
  title,
  children,
  onConfirm,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="confirm-dialog"
      aria-labelledby="confirm-title"
      onCancel={onClose}
    >
      <h2 id="confirm-title">{title}</h2>
      <div>{children}</div>
      <div className="actions">
        <button className="button secondary" onClick={onClose} autoFocus>
          Cancel
        </button>
        <button
          className="button"
          onClick={() => {
            onClose();
            onConfirm();
          }}
        >
          Confirm
        </button>
      </div>
    </dialog>
  );
}
