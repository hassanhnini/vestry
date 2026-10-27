import { cx } from "../ui/primitives";

export function Monogram({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cx("size-8", className)} aria-hidden>
      <rect width="64" height="64" rx="16" fill="currentColor" />
      <path d="M20 22 L32 44 L44 22" fill="none" stroke="#f5f0e8" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="32" cy="16" r="3" fill="#c97a5c" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2.5", className)}>
      <Monogram className="text-ink" />
      <span className="font-display text-[1.45rem] font-medium tracking-[-0.02em]">Vestry</span>
    </span>
  );
}
