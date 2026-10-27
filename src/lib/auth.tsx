"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { cloudEnabled, supabase } from "./supabase/client";

export type AuthMode = "demo" | "cloud";
export interface AuthUser {
  id: string;
  email: string | null;
}
interface AuthState {
  mode: AuthMode;
  status: "loading" | "signed-out" | "signed-in";
  user: AuthUser | null;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string, name: string): Promise<{ needsConfirmation: boolean }>;
  signOut(): Promise<void>;
  sendReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  startDemo(): void;
  getToken(): Promise<string | undefined>;
}

const AuthContext = createContext<AuthState | null>(null);
const DEMO_KEY = "vestry.demo.started";
export const DEMO_USER: AuthUser = { id: "local", email: null };

function readDemo() {
  try {
    return localStorage.getItem(DEMO_KEY) === "1";
  } catch {
    return false;
  }
}
const demoListeners = new Set<() => void>();
function subscribeDemo(cb: () => void) {
  demoListeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    demoListeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}
function setDemo(on: boolean) {
  try {
    if (on) localStorage.setItem(DEMO_KEY, "1");
    else localStorage.removeItem(DEMO_KEY);
  } catch {}
  demoListeners.forEach((l) => l());
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const mode: AuthMode = cloudEnabled ? "cloud" : "demo";
  // Demo flag lives in localStorage; null on the server means "still loading".
  const demoStarted = useSyncExternalStore<boolean | null>(subscribeDemo, readDemo, () => null);
  const [cloud, setCloud] = useState<{ status: AuthState["status"]; user: AuthUser | null }>({ status: "loading", user: null });

  useEffect(() => {
    if (mode !== "cloud") return;
    const sb = supabase();
    const apply = (u: { id: string; email?: string | null } | null | undefined) =>
      setCloud({ status: u ? "signed-in" : "signed-out", user: u ? { id: u.id, email: u.email ?? null } : null });
    sb.auth.getSession().then(({ data }) => apply(data.session?.user));
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => apply(session?.user));
    return () => sub.subscription.unsubscribe();
  }, [mode]);

  const status: AuthState["status"] =
    mode === "cloud" ? cloud.status : demoStarted === null ? "loading" : demoStarted ? "signed-in" : "signed-out";
  const user = mode === "cloud" ? cloud.user : demoStarted ? DEMO_USER : null;

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase().auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message === "Invalid login credentials" ? "That email and password don't match." : error.message);
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    const { data, error } = await supabase().auth.signUp({
      email,
      password,
      options: { data: { display_name: name }, emailRedirectTo: `${window.location.origin}/home` },
    });
    if (error) throw new Error(error.message);
    return { needsConfirmation: !data.session };
  }, []);

  const signOut = useCallback(async () => {
    if (mode === "demo") {
      setDemo(false);
      return;
    }
    await supabase().auth.signOut();
  }, [mode]);

  const sendReset = useCallback(async (email: string) => {
    const { error } = await supabase().auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/update-password` });
    if (error) throw new Error(error.message);
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase().auth.updateUser({ password });
    if (error) throw new Error(error.message);
  }, []);

  const startDemo = useCallback(() => setDemo(true), []);

  const getToken = useCallback(async () => {
    if (mode === "demo") return undefined;
    const { data } = await supabase().auth.getSession();
    return data.session?.access_token;
  }, [mode]);

  const value = useMemo(
    () => ({ mode, status, user, signIn, signUp, signOut, sendReset, updatePassword, startDemo, getToken }),
    [mode, status, user, signIn, signUp, signOut, sendReset, updatePassword, startDemo, getToken],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
