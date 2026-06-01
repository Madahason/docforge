import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type WarningBannerProps = {
  message: string;
  /** Optional "Retry Connection" handler. */
  onRetry?: () => void;
  retryLabel?: string;
  /** If false, hides the dismiss button. Default: true. */
  dismissible?: boolean;
  /** Controlled visibility — when undefined, uses internal state. */
  open?: boolean;
  onDismiss?: () => void;
};

export function WarningBanner({
  message,
  onRetry,
  retryLabel = "Retry Connection",
  dismissible = true,
  open,
  onDismiss,
}: WarningBannerProps) {
  const [internalOpen, setInternalOpen] = useState(true);
  const isOpen = open ?? internalOpen;
  if (!isOpen) return null;

  const handleDismiss = () => {
    setInternalOpen(false);
    onDismiss?.();
  };

  return (
    <div
      role="status"
      className="flex w-full items-center gap-3 px-6 py-3 text-sm"
      style={{
        background: "#1a1100",
        borderBottom: "1px solid #e8c547",
        color: "#f0f0f0",
      }}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: "#e8c547" }} />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
      {dismissible && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={handleDismiss}
          className="rounded p-1 text-muted-foreground hover:bg-white/5 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
