"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { Button, IconButton, cx } from "./primitives";

/* ------------------------------- Toasts ---------------------------------- */
type ToastTone = "success" | "error" | "info";
interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
  action?: { label: string; onClick: () => void };
}
interface OverlayApi {
  toast(message: string, tone?: ToastTone, action?: Toast["action"]): void;
  confirm(opts: ConfirmOpts): Promise<boolean>;
}
interface ConfirmOpts {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

const OverlayCtx = createContext<OverlayApi | null>(null);

export function OverlayProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirm] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const counter = useRef(0);

  const toast = useCallback((message: string, tone: ToastTone = "success", action?: Toast["action"]) => {
    const id = ++counter.current;
    setToasts((t) => [...t.slice(-2), { id, tone, message, action }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 6500 : 4000);
  }, []);

  const confirm = useCallback((opts: ConfirmOpts) => new Promise<boolean>((resolve) => setConfirm({ ...opts, resolve })), []);

  const close = (v: boolean) => {
    confirmState?.resolve(v);
    setConfirm(null);
  };

  return (
    <OverlayCtx.Provider value={{ toast, confirm }}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-3 z-[70] flex flex-col items-center gap-2 px-4 sm:top-auto sm:bottom-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className="pointer-events-auto flex w-full max-w-md animate-fade-up items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-paper shadow-[var(--shadow-lift)]"
          >
            {t.tone === "success" ? <CheckCircle2 className="size-4.5 shrink-0 text-[#cfe0c3]" aria-hidden /> : t.tone === "error" ? <AlertCircle className="size-4.5 shrink-0 text-[#f3b8ab]" aria-hidden /> : <Info className="size-4.5 shrink-0 text-taupe-soft" aria-hidden />}
            <span className="flex-1">{t.message}</span>
            {t.action && (
              <button className="font-semibold underline-offset-2 hover:underline" onClick={t.action.onClick}>
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
      <Sheet open={!!confirmState} onClose={() => close(false)} title={confirmState?.title ?? ""} size="sm">
        {confirmState?.body && <div className="text-[0.9375rem] leading-relaxed text-ink-soft">{confirmState.body}</div>}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => close(false)}>
            {confirmState?.cancelLabel ?? "Cancel"}
          </Button>
          <Button variant={confirmState?.destructive ? "danger" : "primary"} onClick={() => close(true)} autoFocus>
            {confirmState?.confirmLabel ?? "Confirm"}
          </Button>
        </div>
      </Sheet>
    </OverlayCtx.Provider>
  );
}

export function useOverlay() {
  const c = useContext(OverlayCtx);
  if (!c) throw new Error("useOverlay outside OverlayProvider");
  return c;
}

/* ------------------------------- Sheet ----------------------------------- */
/** Bottom sheet on phones, centred dialog on larger screens. Traps focus and closes on Escape. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  size = "md",
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const focusables = () =>
      Array.from(el?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? []).filter((x) => !x.hasAttribute("disabled"));
    const auto = el?.querySelector<HTMLElement>("[autofocus]") ?? focusables()[1] ?? focusables()[0];
    auto?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const f = focusables();
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) {
          e.preventDefault();
          f[f.length - 1].focus();
        } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
          e.preventDefault();
          f[0].focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;
  const widths = { sm: "sm:max-w-md", md: "sm:max-w-lg", lg: "sm:max-w-2xl" };
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 animate-fade-in bg-ink/35 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          "relative flex max-h-[92dvh] w-full animate-sheet-up flex-col rounded-t-[1.75rem] bg-paper shadow-[var(--shadow-lift)] sm:rounded-[1.75rem]",
          widths[size],
        )}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line sm:hidden" aria-hidden />
        <div className="flex items-center justify-between gap-3 px-6 pt-4 pb-2">
          <h2 className="font-display text-xl">{title}</h2>
          <IconButton label="Close" onClick={onClose} className="-mr-2">
            <X className="size-5" />
          </IconButton>
        </div>
        <div className="overflow-y-auto px-6 pb-6">{children}</div>
        {footer && <div className="pb-safe border-t border-line px-6 pt-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
