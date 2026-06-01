import { useEffect, useState } from "react";
import { dismissNotification, showSuccess, showWarning } from "./notifications";

const OFFLINE_TOAST_ID = "docforge-offline-banner";

/**
 * Track the browser's online status and surface warning/success toasts
 * automatically when the connection drops or recovers.
 *
 * Returns the current online state so consumers can pause work if needed.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOffline = () => {
      setOnline(false);
      showWarning({
        id: OFFLINE_TOAST_ID,
        title: "You are offline",
        description: "Some actions are paused. Reconnect to continue.",
        persistent: true,
      });
    };
    const handleOnline = () => {
      setOnline(true);
      dismissNotification(OFFLINE_TOAST_ID);
      showSuccess({
        title: "Back online",
        description: "Connection restored.",
      });
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  return online;
}
