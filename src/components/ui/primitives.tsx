"use client";
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

export function cx(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-paper hover:bg-ink/90 active:bg-ink",
  accent: "bg-clay text-paper hover:bg-clay/90",
  secondary: "bg-paper text-ink ring-1 ring-line hover:ring-taupe-soft hover:bg-white",
  ghost: "text-ink hover:bg-shell/70",
  danger: "bg-danger text-paper hover:bg-danger/90",
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm gap-1.5",
  md: "h-11 px-5 text-[0.9375rem] gap-2",
  lg: "h-13 px-6 text-base gap-2.5",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, icon, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cx(
        "inline-flex select-none items-center justify-center rounded-full font-medium tracking-[-0.005em] transition-all duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45",
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  icon,
  className,
  children,
}: { href: string; variant?: Variant; size?: Size; icon?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={cx(
        "inline-flex select-none items-center justify-center rounded-full font-medium transition-all duration-200 active:scale-[0.98]",
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {icon}
      {children}
    </Link>
  );
}

export function IconButton({
  label,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cx("inline-flex size-11 items-center justify-center rounded-full text-ink transition hover:bg-shell/70 active:scale-95 disabled:opacity-40", className)}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Chip({
  selected,
  onClick,
  children,
  className,
  swatch,
  size = "md",
}: {
  selected?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  swatch?: string;
  size?: "sm" | "md";
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cx(
        "inline-flex shrink-0 items-center gap-2 rounded-full border transition-all duration-150 active:scale-[0.97]",
        size === "sm" ? "h-8 px-3 text-[0.8125rem]" : "h-10 px-4 text-sm",
        selected ? "border-ink bg-ink text-paper" : "border-line bg-paper text-ink hover:border-taupe-soft",
        className,
      )}
    >
      {swatch && <span className="size-3.5 rounded-full ring-1 ring-black/10" style={{ background: swatch }} aria-hidden />}
      {children}
    </button>
  );
}

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: ReactNode; error?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[0.8125rem] text-ink-soft">{hint}</p>
      ) : null}
    </div>
  );
}

const inputBase =
  "w-full rounded-2xl border border-line bg-paper px-4 text-[0.9375rem] text-ink placeholder:text-taupe transition focus:border-ink focus:outline-none focus:ring-0";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx(inputBase, "h-12", className)} {...rest} />;
});

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(inputBase, "min-h-24 py-3", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(inputBase, "h-12 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%235a524b%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[right_1rem_center] bg-no-repeat pr-10", className)} {...rest}>
      {children}
    </select>
  );
}

export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("rounded-[var(--radius-card)] bg-paper shadow-[var(--shadow-soft)] ring-1 ring-line/60", className)} {...rest}>
      {children}
    </div>
  );
}

export function Spinner({ className, label = "Loading" }: { className?: string; label?: string }) {
  return (
    <span role="status" className="inline-flex items-center">
      <Loader2 className={cx("size-5 animate-spin text-taupe", className)} aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function ProgressBar({ value, label }: { value: number | null; label: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-shell" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value === null ? undefined : Math.round(value * 100)}>
      {value === null ? (
        <div className="skeleton h-full w-full !bg-[linear-gradient(90deg,#ece5da,#97492f55,#ece5da)]" />
      ) : (
        <div className="h-full rounded-full bg-clay transition-[width] duration-300" style={{ width: `${Math.max(4, value * 100)}%` }} />
      )}
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body: ReactNode; action?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-sm animate-fade-up flex-col items-center px-6 py-14 text-center">
      {icon && <div className="mb-5 flex size-16 items-center justify-center rounded-full bg-paper text-taupe ring-1 ring-line">{icon}</div>}
      <h2 className="font-display text-2xl">{title}</h2>
      <div className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">{body}</div>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow?: string; title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-4 pb-5 pt-2">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h1 className="font-display text-[2rem] leading-[1.05] sm:text-[2.5rem]">{title}</h1>
        {subtitle && <p className="mt-2 text-[0.9375rem] text-ink-soft">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "accent" | "success" | "warn"; className?: string }) {
  const tones = {
    neutral: "bg-shell text-ink-soft",
    accent: "bg-clay-soft text-clay",
    success: "bg-sage-soft text-sage",
    warn: "bg-[#f5e7c8] text-[#7a5410]",
  };
  return <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.75rem] font-medium", tones[tone], className)}>{children}</span>;
}

/** Shows how sure the analysis was. Never presents a guess as certain, and never calls an on-device estimate "AI". */
export function ConfidenceBadge({ value, source, measured }: { value?: number; source?: string; measured?: boolean }) {
  if (source === "manual" || value === undefined) return null;
  if (source === "on-device") {
    if (measured) return <Badge tone="success">Measured from photo</Badge>;
    return value >= 0.5 ? <Badge tone="neutral">Estimate</Badge> : <Badge tone="warn">Rough estimate · please check</Badge>;
  }
  if (value >= 0.8) return <Badge tone="success">AI · confident</Badge>;
  if (value >= 0.5) return <Badge tone="neutral">AI suggestion</Badge>;
  return <Badge tone="warn">AI unsure · please check</Badge>;
}
