"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { AuthFrame } from "@/components/layout/auth-frame";
import { Button, Field, Input } from "@/components/ui/primitives";

export default function UpdatePassword() {
  const { updatePassword, status } = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  return (
    <AuthFrame title="Choose a new password">
      {status === "signed-out" ? (
        <p className="text-ink-soft">This reset link has expired or was already used. Request a new one from the log-in page.</p>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (password.length < 8) return setError("Use at least 8 characters.");
            setLoading(true);
            setError(null);
            try {
              await updatePassword(password);
              router.replace("/home");
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setLoading(false);
            }
          }}
        >
          <Field label="New password" htmlFor="password" hint="At least 8 characters.">
            <Input id="password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <Button type="submit" size="lg" className="w-full" loading={loading}>Update password</Button>
        </form>
      )}
    </AuthFrame>
  );
}
