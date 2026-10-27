"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Home, Plus, Shirt, Sparkles, UserRound, WifiOff } from "lucide-react";
import { useSyncExternalStore, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { cx } from "../ui/primitives";
import { Wordmark } from "./brand";

const NAV = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/closet", label: "Closet", icon: Shirt },
  { href: "/stylist", label: "Style", icon: Sparkles },
  { href: "/planner", label: "Planner", icon: CalendarDays },
  { href: "/profile", label: "Profile", icon: UserRound },
];

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}
function useOnline() {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { mode } = useAuth();
  const online = useOnline();
  const active = (href: string) => path === href || path.startsWith(href + "/") || (href === "/stylist" && path.startsWith("/outfits"));
  const showFab = !path.startsWith("/add") && !path.startsWith("/stylist") && !path.startsWith("/settings");

  return (
    <div className="min-h-dvh lg:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-paper">
        Skip to content
      </a>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line/80 bg-paper/60 px-5 py-7 lg:flex">
        <Link href="/home" aria-label="Vestry home" className="px-2">
          <Wordmark />
        </Link>
        <Link
          href="/add"
          className="mt-8 flex h-12 items-center justify-center gap-2 rounded-full bg-ink text-[0.9375rem] font-medium text-paper transition hover:bg-ink/90"
        >
          <Plus className="size-4.5" aria-hidden /> Add clothes
        </Link>
        <nav aria-label="Main" className="mt-6 flex flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={active(href) ? "page" : undefined}
              className={cx(
                "flex h-11 items-center gap-3 rounded-xl px-3 text-[0.9375rem] transition",
                active(href) ? "bg-shell font-medium text-ink" : "text-ink-soft hover:bg-shell/60 hover:text-ink",
              )}
            >
              <Icon className="size-[1.15rem]" aria-hidden strokeWidth={active(href) ? 2.2 : 1.7} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto space-y-2 px-2 text-xs leading-relaxed text-taupe">
          {mode === "demo" && <p>Demo mode · your closet is stored only in this browser.</p>}
          <Link href="/settings" className="underline-offset-2 hover:underline">
            Settings & privacy
          </Link>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {mode === "demo" && (
          <div className="border-b border-line/70 bg-shell/60 px-4 py-1.5 text-center text-[0.75rem] text-ink-soft lg:hidden">
            Demo mode — data stays on this device only.{" "}
            <Link href="/settings#storage" className="font-medium text-ink underline underline-offset-2">
              Learn more
            </Link>
          </div>
        )}
        {!online && (
          <div role="status" className="flex items-center justify-center gap-2 bg-[#f5e7c8] px-4 py-2 text-[0.8125rem] text-[#7a5410]">
            <WifiOff className="size-4" aria-hidden /> You&apos;re offline. {mode === "demo" ? "Your closet still works; cloud AI is unavailable." : "Changes may not save until you reconnect."}
          </div>
        )}
        <main id="main" className="mx-auto w-full max-w-6xl px-4 pb-32 pt-4 sm:px-6 lg:px-10 lg:pb-16 lg:pt-8">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      {showFab && (
        <Link
          href="/add"
          aria-label="Add clothes"
          className="fixed bottom-[5.5rem] right-4 z-40 flex size-14 items-center justify-center rounded-full bg-ink text-paper shadow-[var(--shadow-lift)] transition active:scale-95 lg:hidden"
        >
          <Plus className="size-6" aria-hidden />
        </Link>
      )}
      <nav aria-label="Main" className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line/80 bg-paper/92 backdrop-blur-md lg:hidden">
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {NAV.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={active(href) ? "page" : undefined}
                className={cx("flex h-16 flex-col items-center justify-center gap-1 text-[0.6875rem] transition", active(href) ? "text-ink" : "text-taupe")}
              >
                <Icon className="size-[1.35rem]" aria-hidden strokeWidth={active(href) ? 2.2 : 1.6} />
                <span className={active(href) ? "font-semibold" : ""}>{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
