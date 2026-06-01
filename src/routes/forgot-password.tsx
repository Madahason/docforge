import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
    toast.success("Password reset email sent. Check your inbox.");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-md border border-border bg-[var(--surface)] p-8">
        <h1 className="mb-2 text-center text-2xl font-bold" style={{ color: "var(--accent-gold)" }}>
          Reset password
        </h1>
        <p className="mb-6 text-center text-sm text-muted-foreground">
          Enter your email and we'll send you a reset link.
        </p>

        {sent ? (
          <div className="space-y-4 text-center text-sm text-muted-foreground">
            <p>
              If an account exists for <span className="text-foreground">{email}</span>, a password
              reset link is on its way.
            </p>
            <Link
              to="/login"
              className="inline-block font-medium"
              style={{ color: "var(--accent-gold)" }}
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-primary text-primary-foreground hover:bg-[var(--accent-gold-hover)]"
            >
              {submitting ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Remembered it?{" "}
          <Link to="/login" className="font-medium" style={{ color: "var(--accent-gold)" }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
