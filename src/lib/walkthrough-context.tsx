import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { WALKTHROUGH_STEPS, TOTAL_STEPS, type WalkthroughStepId } from "@/lib/walkthrough-steps";

interface WalkthroughContextValue {
  isActive: boolean;
  showWelcome: boolean;
  showResume: boolean;
  /** 1-based current step index, or 0 when not started */
  currentStep: number;
  totalSteps: number;
  currentStepId: WalkthroughStepId | null;
  gateMet: boolean;

  startTour: () => void;
  dismissWelcome: () => void;
  acceptResume: () => void;
  declineResume: () => void;

  next: () => void;
  back: () => void;
  skip: () => void;
  complete: () => void;

  setGateMet: (stepId: WalkthroughStepId, met: boolean) => void;
}

const Ctx = createContext<WalkthroughContextValue | undefined>(undefined);

export function WalkthroughProvider({ children }: { children: ReactNode }) {
  const { user, profile, setProfile } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showResume, setShowResume] = useState(false);
  const [gateMap, setGateMap] = useState<Partial<Record<WalkthroughStepId, boolean>>>({});
  const initRef = useRef(false);

  // Initialize from profile once it's loaded
  useEffect(() => {
    if (!profile || initRef.current) return;
    initRef.current = true;
    if (profile.walkthrough_complete) return;
    if (profile.walkthrough_step > 0) {
      setShowResume(true);
      setCurrentStep(profile.walkthrough_step);
    }
    // Welcome-modal trigger is owned by the dashboard route
    // (it needs to know project count); we expose `startTour` for that.
  }, [profile]);

  const persist = useCallback(
    async (patch: { walkthrough_step?: number; walkthrough_complete?: boolean }) => {
      if (!user) return;
      const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
      if (!error && profile) {
        setProfile({ ...profile, ...patch });
      }
    },
    [user, profile, setProfile],
  );

  const startTour = useCallback(() => {
    setShowWelcome(false);
    setShowResume(false);
    setIsActive(true);
    setCurrentStep(1);
    void persist({ walkthrough_step: 1, walkthrough_complete: false });
  }, [persist]);

  const dismissWelcome = useCallback(() => {
    setShowWelcome(false);
    setIsActive(false);
    void persist({ walkthrough_complete: true, walkthrough_step: 0 });
  }, [persist]);

  const acceptResume = useCallback(() => {
    setShowResume(false);
    setIsActive(true);
  }, []);

  const declineResume = useCallback(() => {
    setShowResume(false);
    setIsActive(false);
    void persist({ walkthrough_complete: true });
  }, [persist]);

  const next = useCallback(() => {
    setCurrentStep((s) => {
      const ns = Math.min(TOTAL_STEPS, s + 1);
      void persist({ walkthrough_step: ns });
      return ns;
    });
  }, [persist]);

  const back = useCallback(() => {
    setCurrentStep((s) => {
      const ns = Math.max(1, s - 1);
      void persist({ walkthrough_step: ns });
      return ns;
    });
  }, [persist]);

  const skip = useCallback(() => {
    setIsActive(false);
    setCurrentStep(0);
    void persist({ walkthrough_complete: true });
  }, [persist]);

  const complete = useCallback(() => {
    setIsActive(false);
    setCurrentStep(TOTAL_STEPS);
    void persist({ walkthrough_complete: true, walkthrough_step: TOTAL_STEPS });
  }, [persist]);

  const setGateMet = useCallback((stepId: WalkthroughStepId, met: boolean) => {
    setGateMap((m) => (m[stepId] === met ? m : { ...m, [stepId]: met }));
  }, []);

  const currentStepDef = currentStep > 0 ? WALKTHROUGH_STEPS[currentStep - 1] : null;
  const currentStepId = currentStepDef?.id ?? null;
  const gateMet = !currentStepDef?.requiresGate || !!gateMap[currentStepDef.id];

  // Expose a helper so the dashboard route can decide whether to show welcome.
  // We do that by setting `showWelcome` from outside via a wrapper hook.
  const value = useMemo<WalkthroughContextValue>(
    () => ({
      isActive,
      showWelcome,
      showResume,
      currentStep,
      totalSteps: TOTAL_STEPS,
      currentStepId,
      gateMet,
      startTour,
      dismissWelcome,
      acceptResume,
      declineResume,
      next,
      back,
      skip,
      complete,
      setGateMet,
    }),
    [
      isActive,
      showWelcome,
      showResume,
      currentStep,
      currentStepId,
      gateMet,
      startTour,
      dismissWelcome,
      acceptResume,
      declineResume,
      next,
      back,
      skip,
      complete,
      setGateMet,
    ],
  );

  // Expose internal setter via context too (cast)
  (value as unknown as { _setShowWelcome: (v: boolean) => void })._setShowWelcome = setShowWelcome;

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWalkthrough() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useWalkthrough must be used inside WalkthroughProvider");
  return c;
}

/** Internal: dashboard calls this to request the welcome modal. */
export function useWalkthroughInternalSetWelcome() {
  const c = useWalkthrough();
  return (c as unknown as { _setShowWelcome: (v: boolean) => void })._setShowWelcome;
}

/** Components owning a target call this to report whether their gate is satisfied. */
export function useWalkthroughGate(stepId: WalkthroughStepId, met: boolean) {
  const { setGateMet } = useWalkthrough();
  useEffect(() => {
    setGateMet(stepId, met);
  }, [stepId, met, setGateMet]);
}
