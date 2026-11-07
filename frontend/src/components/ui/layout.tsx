import { useEffect, useRef, type ReactNode } from "react";
import { CircleAlert, Info, TriangleAlert } from "lucide-react";

export function PageHeader({
  title,
  eyebrow,
  description,
  status,
  actions,
}: {
  title: string;
  eyebrow?: ReactNode;
  description?: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-header__main">
        {eyebrow && <div className="page-header__eyebrow">{eyebrow}</div>}
        <div className="page-header__title">
          <h1>{title}</h1>
          {status}
        </div>
        {description && (
          <p className="page-header__description">{description}</p>
        )}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  footer,
  flush = false,
  id,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  flush?: boolean;
  id?: string;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section className="panel" aria-labelledby={headingId} id={id}>
      <div className="panel__header">
        <div>
          <h2 id={headingId}>{title}</h2>
          {description && <p className="panel__description">{description}</p>}
        </div>
        {actions}
      </div>
      <div className={`panel__body${flush ? " panel__body--flush" : ""}`}>
        {children}
      </div>
      {footer && <div className="panel__footer">{footer}</div>}
    </section>
  );
}

/** One plain sentence and the next action. */
export function EmptyState({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <p>{children}</p>
      {action && <div className="empty__action">{action}</div>}
    </div>
  );
}

export function Notice({
  tone = "info",
  title,
  children,
  action,
}: {
  tone?: "info" | "warn" | "err" | "ok";
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const Icon =
    tone === "err" ? CircleAlert : tone === "warn" ? TriangleAlert : Info;
  return (
    <div
      className={`notice notice--${tone}`}
      role={tone === "err" ? "alert" : "status"}
    >
      <Icon size={16} aria-hidden />
      <div className="notice__body">
        {title && <p className="notice__title">{title}</p>}
        {children && <div>{children}</div>}
      </div>
      {action && <div className="notice__action">{action}</div>}
    </div>
  );
}

export function ErrorNotice({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <Notice
      tone="err"
      title="Could not load on-chain data"
      action={
        retry && (
          <button className="btn btn--secondary btn--sm" onClick={retry}>
            Retry
          </button>
        )
      }
    >
      {message}
    </Notice>
  );
}

/** Confirmation for irreversible or high-impact actions, before the wallet opens. */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  danger = false,
  onConfirm,
  onClose,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="confirm-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="dialog__header">
        <h2 id="confirm-title">{title}</h2>
      </div>
      <div className="dialog__body">{children}</div>
      <div className="dialog__actions">
        <button className="btn btn--secondary" onClick={onClose} autoFocus>
          Cancel
        </button>
        <button
          className={`btn ${danger ? "btn--danger" : "btn--primary"}`}
          onClick={() => {
            onClose();
            onConfirm();
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
