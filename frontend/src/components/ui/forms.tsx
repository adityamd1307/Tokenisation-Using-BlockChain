import { useId, type ReactNode } from "react";
import {
  ChevronDown,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleX,
  Info,
  LoaderCircle,
} from "lucide-react";

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: ReactNode;
  error?: string;
  /** A live check shown under the input (e.g. recipient eligibility). */
  status?: { tone: "ok" | "err" | "pending"; text: string };
  suffix?: ReactNode;
  addon?: ReactNode;
  mono?: boolean;
  placeholder?: string;
  inputMode?: "numeric" | "decimal" | "text";
  name?: string;
  required?: boolean;
  className?: string;
}

/** Text input with a visible label, hint, error and optional unit suffix. */
export function TextField({
  label,
  value,
  onChange,
  hint,
  error,
  status,
  suffix,
  addon,
  mono = false,
  placeholder,
  inputMode,
  name,
  required,
  className,
}: FieldProps) {
  const id = useId();
  const described = [
    hint && `${id}-hint`,
    error && `${id}-error`,
    status && `${id}-status`,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={`field${className ? ` ${className}` : ""}`}>
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <div className="field__control" data-invalid={error ? "true" : undefined}>
        <input
          id={id}
          name={name}
          className={`field__input${mono ? " field__input--mono" : ""}`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          inputMode={inputMode}
          autoComplete="off"
          spellCheck={false}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={described || undefined}
        />
        {suffix && <span className="field__suffix">{suffix}</span>}
        {addon && <span className="field__addon">{addon}</span>}
      </div>
      {status && !error && (
        <span
          id={`${id}-status`}
          className={`field__status field__status--${status.tone}`}
          role="status"
        >
          {status.tone === "ok" ? (
            <CircleCheck aria-hidden />
          ) : status.tone === "err" ? (
            <CircleX aria-hidden />
          ) : (
            <LoaderCircle aria-hidden className="spin" />
          )}
          {status.text}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} className="field__error" role="alert">
          <CircleAlert aria-hidden />
          {error}
        </span>
      )}
      {hint && (
        <span id={`${id}-hint`} className="field__hint">
          {hint}
        </span>
      )}
    </div>
  );
}

/**
 * Amount in whole units (AssetToken.decimals() is 0): symbol suffix and a Max
 * button. The caller passes the validation message so it can include balances.
 */
export function AmountField({
  symbol,
  onMax,
  maxLabel = "Max",
  ...props
}: Omit<FieldProps, "suffix" | "addon" | "inputMode" | "mono"> & {
  symbol: string;
  onMax?: () => void;
  maxLabel?: string;
}) {
  return (
    <TextField
      {...props}
      mono
      inputMode="numeric"
      placeholder={props.placeholder ?? "0"}
      suffix={symbol}
      addon={
        onMax && (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={onMax}
            aria-label={`${maxLabel}: use the largest valid amount`}
          >
            {maxLabel}
          </button>
        )
      }
    />
  );
}

export function AddressField(
  props: Omit<FieldProps, "mono" | "placeholder" | "inputMode">,
) {
  return <TextField {...props} mono placeholder="0x…" />;
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  hint,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  hint?: string;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={`field${className ? ` ${className}` : ""}`}>
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <div className="field__control">
        <select
          id={id}
          className="field__input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={hint ? `${id}-hint` : undefined}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="field__caret" aria-hidden />
      </div>
      {hint && (
        <span id={`${id}-hint`} className="field__hint">
          {hint}
        </span>
      )}
    </div>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  hint,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <div className="field__control">
        <textarea
          id={id}
          className="field__input"
          value={value}
          rows={3}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={hint ? `${id}-hint` : undefined}
        />
      </div>
      {hint && (
        <span id={`${id}-hint`} className="field__hint">
          {hint}
        </span>
      )}
    </div>
  );
}

export interface Check {
  label: string;
  /** true passed, false failed, undefined still being read. */
  ok: boolean | undefined;
  /** Why it failed, shown next to the action when it is the first failure. */
  reason?: string;
  detail?: ReactNode;
}

/** The first reason an action is blocked, or undefined when every check passes. */
export function blocker(checks: Check[]): string | undefined {
  const pending = checks.find((check) => check.ok === undefined);
  const failed = checks.find((check) => check.ok === false);
  if (failed) return failed.reason ?? failed.label;
  if (pending) return "Checking on-chain state…";
  return undefined;
}

/** Pre-flight checks read from the chain before the user is asked to sign. */
export function Checklist({
  checks,
  label,
}: {
  checks: Check[];
  label: string;
}) {
  return (
    <ul className="checklist" aria-label={label}>
      {checks.map((check) => (
        <li
          key={check.label}
          className={`checklist__item checklist__item--${
            check.ok === undefined ? "pending" : check.ok ? "ok" : "fail"
          }`}
        >
          {check.ok === undefined ? (
            <CircleDashed aria-hidden />
          ) : check.ok ? (
            <CircleCheck aria-hidden />
          ) : (
            <CircleX aria-hidden />
          )}
          <span>
            {check.label}
            <span className="visually-hidden">
              {check.ok === undefined
                ? " (checking)"
                : check.ok
                  ? " (passed)"
                  : " (not met)"}
            </span>
          </span>
          {check.detail && (
            <span className="checklist__detail">{check.detail}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * A button that is disabled with its reason written next to it, so the user can
 * see why before signing. `reason` undefined means the action is available.
 */
export function ActionButton({
  children,
  reason,
  onClick,
  type = "button",
  variant = "primary",
  size,
}: {
  children: ReactNode;
  reason?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "danger";
  size?: "sm";
}) {
  const id = useId();
  return (
    <div className="submit-row">
      <button
        type={type}
        className={`btn btn--${variant}${size ? ` btn--${size}` : ""}`}
        disabled={!!reason}
        onClick={onClick}
        aria-describedby={reason ? id : undefined}
      >
        {children}
      </button>
      {reason && (
        <span id={id} className="submit-row__reason">
          <Info aria-hidden />
          {reason}
        </span>
      )}
    </div>
  );
}

/** What the transaction will do, in one sentence, before the user signs. */
export function Summary({
  sentence,
  rows,
}: {
  sentence: ReactNode;
  rows?: { label: string; value: ReactNode }[];
}) {
  return (
    <div className="summary" aria-live="polite">
      <p className="summary__sentence">{sentence}</p>
      {rows && (
        <dl className="facts facts--compact">
          {rows.map((row) => (
            <FactPair key={row.label} {...row} />
          ))}
        </dl>
      )}
    </div>
  );
}
function FactPair({ label, value }: { label: string; value: ReactNode }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}
