"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { AuthFrame } from "@/components/layout/auth-frame";
import { Button, Field, Input } from "@/components/ui/primitives";

export default function Login() {
  const { signIn, status } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (status === "signed-in") router.replace("/home");
  }, [status, router]);
  return (
    <AuthFrame title="Welcome back" subtitle="Log in to your closet." footer={<>New here? <Link href="/auth/signup" className="font-medium text-ink underline underline-offset-2">Create an account</Link></>}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setLoading(true);
          try {
            await signIn(email.trim(), password);
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
        <Field label="Password" htmlFor="password">
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <Button type="submit" size="lg" className="w-full" loading={loading}>Log in</Button>
        <p className="text-center text-sm">
          <Link href="/auth/reset" className="text-ink-soft underline underline-offset-2 hover:text-ink">Forgot your password?</Link>
        </p>
      </form>
    </AuthFrame>
  );
}
