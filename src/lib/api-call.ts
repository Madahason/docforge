import { showError } from "./notifications";

/**
 * Classify a thrown value and show a contextual error toast.
 *
 * Usage:
 *   const result = await apiCall(
 *     () => supabase.from("projects").select("*"),
 *     "Loading projects",
 *   );
 *
 * The wrapper rethrows after surfacing the toast so callers can still
 * detect failure and skip downstream side effects.
 */

type ApiError = {
  message?: string;
  status?: number;
  code?: string;
};

export type ApiCallOptions = {
  retryable?: boolean;
  /** Override the default retry behavior of just re-invoking `fn`. */
  onRetry?: () => void;
  /** When true (default), surface a toast on failure. */
  showToast?: boolean;
};

function classify(error: ApiError) {
  const msg = error.message ?? "";
  const isNetwork =
    msg === "Failed to fetch" ||
    msg === "Network Error" ||
    msg.includes("NetworkError") ||
    msg.includes("network request failed");
  const isTimeout = msg.toLowerCase().includes("timeout") || error.code === "ETIMEDOUT";
  const isAuth =
    error.status === 401 || msg.includes("JWT") || msg.toLowerCase().includes("unauthorized");
  const isRateLimit = error.status === 429 || msg.toLowerCase().includes("rate limit");
  return { isNetwork, isTimeout, isAuth, isRateLimit };
}

export async function apiCall<T>(
  fn: () => Promise<T>,
  errorContext: string,
  options: ApiCallOptions = {},
): Promise<T> {
  const { retryable = true, onRetry, showToast = true } = options;
  try {
    return await fn();
  } catch (raw) {
    const error = (raw ?? {}) as ApiError;
    if (!showToast) throw raw;

    const { isNetwork, isTimeout, isAuth, isRateLimit } = classify(error);
    const retryFn = retryable
      ? (onRetry ?? (() => void apiCall(fn, errorContext, options).catch(() => {})))
      : undefined;

    if (isNetwork) {
      showError({
        title: "Connection lost",
        description: "Check your internet connection and try again.",
        retryable,
        retryFn,
      });
    } else if (isTimeout) {
      showError({
        title: `${errorContext} timed out`,
        description:
          "This is taking longer than expected. Try again or contact support if it persists.",
        retryable,
        retryFn,
      });
    } else if (isAuth) {
      showError({
        title: "Session expired",
        description: "Please sign in again to continue.",
        action: {
          label: "Sign in",
          fn: () => {
            if (typeof window !== "undefined") window.location.href = "/login";
          },
        },
      });
    } else if (isRateLimit) {
      showError({
        title: "Too many requests",
        description: "You've hit the API limit. Wait 60 seconds and try again.",
        retryable,
        retryFn,
      });
    } else {
      showError({
        title: `${errorContext} failed`,
        description: error.message || "Something went wrong. Please try again.",
        retryable,
        retryFn,
      });
    }
    throw raw;
  }
}
