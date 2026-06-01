import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { HelpCircle, AlertTriangle, ExternalLink, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { debugError } from "@/utils/debug";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user, profile, setProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [restarting, setRestarting] = useState(false);

  const { data: profileRow } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const restartWalkthrough = async () => {
    if (!user) return;
    setRestarting(true);
    const { error } = await supabase
      .from("profiles")
      .update({ walkthrough_complete: false, walkthrough_step: 0 })
      .eq("id", user.id);
    setRestarting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (profile) {
      setProfile({ ...profile, walkthrough_complete: false, walkthrough_step: 0 });
    }
    toast.success("Walkthrough restarted");
    navigate({ to: "/projects" });
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setDeleting(true);
    try {
      // Cascade: delete projects (RLS owned). Auth row stays until user contacts support.
      const { error } = await supabase.from("projects").delete().eq("user_id", user.id);
      if (error) throw error;
      toast.success("All project data deleted. Signing out…");
      await signOut?.();
      navigate({ to: "/login" });
    } catch (e: any) {
      debugError(e);
      toast.error(e?.message ?? "Failed to delete account data");
    } finally {
      setDeleting(false);
    }
  };

  const tier = profileRow?.subscription_tier ?? "free";

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 pb-16 pt-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your account and workspace preferences
        </p>
      </div>

      {/* Account */}
      <section className="rounded-md border border-border bg-[var(--surface)] p-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Account
        </h2>
        <dl className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Full name</dt>
            <dd className="mt-1 text-foreground">
              {profileRow?.full_name || user?.user_metadata?.full_name || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Email</dt>
            <dd className="mt-1 text-foreground">{user?.email}</dd>
          </div>
        </dl>
      </section>

      {/* Subscription */}
      <section className="rounded-md border border-border bg-[var(--surface)] p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Subscription
            </h2>
            <p className="mt-3 text-sm">
              Current plan: <span className="font-semibold capitalize text-foreground">{tier}</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              DocForge is in private beta. Paid tiers coming soon.
            </p>
          </div>
          <Button variant="outline" disabled className="border-border bg-transparent">
            Upgrade
          </Button>
        </div>
      </section>

      {/* Help */}
      <section className="rounded-md border border-border bg-[var(--surface)] p-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Help & Onboarding
        </h2>
        <div className="mt-4 flex flex-col gap-3">
          <div>
            <AsyncButton
              variant="outline"
              loading={restarting}
              onClick={restartWalkthrough}
              icon={<HelpCircle className="h-4 w-4" />}
              className="border-border bg-transparent"
            >
              Restart walkthrough
            </AsyncButton>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="ghost" size="sm">
              <a href="mailto:support@docforge.app">
                <Mail className="mr-2 h-4 w-4" /> Email support
              </a>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <a href="https://docs.docforge.app" target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" /> Documentation
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Danger Zone */}
      <section className="rounded-md border border-[var(--error)] bg-[var(--surface)] p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--error)]" />
          <div className="flex-1">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--error)]">
              Danger Zone
            </h2>
            <p className="mt-2 text-sm text-foreground">Delete all project data</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Permanently removes every project, scene, voiceover, clip, and graphic you've created.
              This cannot be undone. Type{" "}
              <code className="rounded bg-[var(--surface-elevated)] px-1 py-0.5 text-[11px] text-foreground">
                DELETE
              </code>{" "}
              to confirm.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Label htmlFor="delete-confirm" className="sr-only">
                  Confirm deletion
                </Label>
                <Input
                  id="delete-confirm"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder="Type DELETE"
                  className="border-border"
                />
              </div>
              <AsyncButton
                variant="destructive"
                loading={deleting}
                loadingLabel="Deleting…"
                disabled={deleteConfirm !== "DELETE"}
                disabledReason="Type DELETE to confirm"
                onClick={handleDeleteAccount}
              >
                Delete all data
              </AsyncButton>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
