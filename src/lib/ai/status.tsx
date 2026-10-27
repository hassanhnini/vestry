"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { AiStatus } from "./schema";

const Ctx = createContext<{ status: AiStatus | null; checked: boolean }>({ status: null, checked: false });

/** Asks the server which optional AI services are configured (never exposes keys). */
export function AiStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    fetch("/api/ai/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => setStatus(s))
      .catch(() => setStatus(null))
      .finally(() => setChecked(true));
  }, []);
  return <Ctx.Provider value={{ status, checked }}>{children}</Ctx.Provider>;
}

export const useAiStatus = () => useContext(Ctx);
