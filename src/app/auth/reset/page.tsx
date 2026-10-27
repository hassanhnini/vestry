"use client";
import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { AuthFrame } from "@/components/layout/auth-frame";
import { Button, Field, Input } from "@/components/ui/primitives";

export default function Reset() {
  const { sendReset } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  return (
    <AuthFrame title="Reset your password" subtitle="We'll email you a secure link." footer={<Link href="/auth/login" className="underline underline-offset-2">Back to log in</Link>}>
      {sent ? (
        <p className="rounded-2xl bg-paper p-5 ring-1 ring-line" role="status">If an account exists for <strong>{email}</strong>, a reset link is on its way.</p>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            setError(null);
            try {
              await sendReset(email.trim());
              setSent(true);
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setLoading(false);
            }
          }}
        >
          <Field label="Email" htmlFor="email">
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <Button type="submit" size="lg" className="w-full" loading={loading}>Send reset link</Button>
        </form>
      )}
    </AuthFrame>
  );
}
