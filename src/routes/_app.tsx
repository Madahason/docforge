import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { TopNav } from "@/components/TopNav";
import { PageTransition } from "@/components/PageTransition";
import { useAuth } from "@/hooks/use-auth";
import { useOnlineStatus } from "@/lib/online-status";
import { WalkthroughProvider } from "@/lib/walkthrough-context";
import { WalkthroughOverlay, ResumePrompt } from "@/components/walkthrough/WalkthroughOverlay";
import { WelcomeModal } from "@/components/walkthrough/WelcomeModal";
import { FeedbackWidget } from "@/components/FeedbackWidget";
import { ShortcutsModal } from "@/components/ShortcutsModal";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading, profile, profileLoading } = useAuth();
  useOnlineStatus();

  if (loading || (user && profileLoading && !profile)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" />;
  if (profile && !profile.onboarding_complete) return <Navigate to="/onboarding" />;

  return (
    <WalkthroughProvider>
      <div className="flex min-h-screen flex-col bg-background">
        <TopNav />
        <main className="flex-1 pt-14">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>
        <footer className="border-t border-border py-3 text-center text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          DocForge Beta v0.1
        </footer>
        <WelcomeModal />
        <ResumePrompt />
        <WalkthroughOverlay />
        <FeedbackWidget />
        <ShortcutsModal />
      </div>
    </WalkthroughProvider>
  );
}
