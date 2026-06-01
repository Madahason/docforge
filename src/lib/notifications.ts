import { toast, type ExternalToast } from "sonner";

/**
 * Global notification helpers — wrap sonner with DocForge styling.
 *
 * Three flavors:
 *   showError   — red left border, auto-dismiss 8s
 *   showWarning — gold left border, auto-dismiss 6s
 *   showSuccess — green left border, auto-dismiss 3s
 *
 * Stacking, hover-pause, and slide animations are handled by sonner's
 * <Toaster /> (mounted in __root.tsx). To enforce the spec further,
 * the Toaster is configured with visibleToasts={3} and position="top-right".
 */

type ActionConfig = {
  label: string;
  fn: () => void;
};

export type ShowOptions = {
  title: string;
  description?: string;
  /** If true and `retryFn` is set, shows a Retry button. */
  retryable?: boolean;
  retryFn?: () => void;
  /** Optional secondary action (e.g. "Sign in", "Open ElevenLabs"). */
  action?: ActionConfig;
  /** When true, do not auto-dismiss. Use sparingly. */
  persistent?: boolean;
  /** Stable id — pass to allow update/dismiss of an existing toast. */
  id?: string | number;
};

const ERROR_STYLE: React.CSSProperties = {
  background: "#1a0000",
  borderLeft: "4px solid #f44336",
  borderRadius: "6px",
  padding: "16px 20px",
  maxWidth: "420px",
  color: "#f0f0f0",
};

const WARNING_STYLE: React.CSSProperties = {
  background: "#1a1100",
  borderLeft: "4px solid #e8c547",
  borderRadius: "6px",
  padding: "16px 20px",
  maxWidth: "420px",
  color: "#f0f0f0",
};

const SUCCESS_STYLE: React.CSSProperties = {
  background: "#001a00",
  borderLeft: "4px solid #4caf50",
  borderRadius: "6px",
  padding: "16px 20px",
  maxWidth: "420px",
  color: "#f0f0f0",
};

function buildToastOptions(opts: ShowOptions, baseDuration: number): ExternalToast {
  const out: ExternalToast = {
    description: opts.description,
    duration: opts.persistent ? Infinity : baseDuration,
    id: opts.id,
    closeButton: true,
  };
  if (opts.action) {
    out.action = { label: opts.action.label, onClick: opts.action.fn };
  } else if (opts.retryable && opts.retryFn) {
    out.action = { label: "Retry", onClick: opts.retryFn };
  }
  return out;
}

export function showError(opts: ShowOptions) {
  return toast.error(opts.title, {
    ...buildToastOptions(opts, 8000),
    style: ERROR_STYLE,
  });
}

export function showWarning(opts: ShowOptions) {
  return toast.warning(opts.title, {
    ...buildToastOptions(opts, 6000),
    style: WARNING_STYLE,
  });
}

export function showSuccess(opts: ShowOptions) {
  return toast.success(opts.title, {
    ...buildToastOptions(opts, 3000),
    style: SUCCESS_STYLE,
  });
}

export function dismissNotification(id: string | number) {
  toast.dismiss(id);
}
