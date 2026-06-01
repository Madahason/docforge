import { supabase } from "@/integrations/supabase/client";
import { debugError } from "@/utils/debug";

let installed = false;

async function logError(args: { message: string; stack?: string; component?: string }) {
  try {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) return; // RLS requires authenticated user
    await supabase.from("error_logs").insert({
      user_id: userId,
      error_message: args.message.slice(0, 2000),
      error_stack: args.stack?.slice(0, 8000) ?? null,
      page_url: typeof window !== "undefined" ? window.location.href : null,
      component: args.component ?? null,
    });
  } catch (err) {
    debugError("[error-logger] failed to record", err);
  }
}

export function installGlobalErrorLogging() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message =
      reason instanceof Error ? reason.message : String(reason ?? "Unhandled rejection");
    const stack = reason instanceof Error ? reason.stack : undefined;
    void logError({ message, stack, component: "unhandledrejection" });
  });

  window.addEventListener("error", (event) => {
    const message = event.message || "window error";
    const stack = event.error instanceof Error ? event.error.stack : undefined;
    void logError({ message, stack, component: "window.onerror" });
  });
}

export function reportError(error: unknown, component?: string) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  void logError({ message, stack, component });
}
