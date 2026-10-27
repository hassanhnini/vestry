"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MailCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { AuthFrame } from "@/components/layout/auth-frame";
import { Button, Field, Input } from "@/components/ui/primitives";

export default function Signup() {
  const { signUp, status } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  useEffect(() => {
    if (status === "signed-in") router.replace("/onboarding");
  }, [status, router]);

  if (sent)
    return (
      <AuthFrame title="Check your inbox">
        <div className="rounded-2xl bg-paper p-6 ring-1 ring-line">
          <MailCheck className="size-7 text-clay" aria-hidden />
          <p className="mt-3">We sent a confirmation link to <strong>{email}</strong>. Open it to activate your closet.</p>
        </div>
      </AuthFrame>
    );

  return (
    <AuthFrame title="Create your closet" subtitle="Free, private, and yours." footer={<>Already have an account? <Link href="/auth/login" className="font-medium text-ink underline underline-offset-2">Log in</Link></>}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          if (password.length < 8) return setError("Use at least 8 characters for your password.");
          setLoading(true);
          try {
            const r = await signUp(email.trim(), password, name.trim().slice(0, 40));
            if (r.needsConfirmation) setSent(true);
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setLoading(false);
          }
        }}
      >
        <Field label="First name (optional)" htmlFor="name">
          <Input id="name" autoComplete="given-name" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" htmlFor="password" hint="At least 8 characters.">
          <Input id="password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <Button type="submit" size="lg" className="w-full" loading={loading}>Create account</Button>
      </form>
    </AuthFrame>
  );
}
