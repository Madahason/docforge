export type WalkthroughStepId =
  | "new-project-btn"
  | "script-textarea"
  | "editing-style"
  | "scene-list"
  | "analyze-script"
  | "generate-all-visuals"
  | "generate-all-voiceovers"
  | "export-package";

export type Placement = "top" | "bottom" | "left" | "right";

export interface WalkthroughStep {
  id: WalkthroughStepId;
  title: string;
  description: string;
  placement: Placement;
  actionHint?: string;
  /** When true, Next is disabled until the matching gate is reported true. */
  requiresGate?: boolean;
  /** Path the step lives on (used for resume prompts). */
  path: "/projects" | "/projects/new" | "/projects/$projectId";
}

export const WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    id: "new-project-btn",
    title: "Start with your script",
    description:
      "Everything begins with your script. DocForge breaks it into scenes, generates visuals, voiceovers, and captions automatically.",
    placement: "bottom",
    path: "/projects",
  },
  {
    id: "script-textarea",
    title: "Paste your script here",
    description:
      "DocForge handles scripts of any length. It analyzes each scene and recommends the best visual type automatically.",
    placement: "top",
    actionHint: "Paste your script to continue",
    requiresGate: true,
    path: "/projects/new",
  },
  {
    id: "editing-style",
    title: "Choose your editing style",
    description:
      "This controls the pacing, cut density, and visual rhythm of your entire video. You can change it per project.",
    placement: "right",
    path: "/projects/new",
  },
  {
    id: "scene-list",
    title: "Your script is now scenes",
    description:
      "DocForge broke your script into individual scenes. Each scene gets its own voiceover, visual, graphic, and caption.",
    placement: "right",
    path: "/projects/$projectId",
  },
  {
    id: "analyze-script",
    title: "Analyze your script",
    description:
      "This is the most important step. DocForge reads every scene and recommends the perfect visual type — motion graphic, AI image, or real footage.",
    placement: "right",
    actionHint: "Click Analyze Script to continue",
    requiresGate: true,
    path: "/projects/$projectId",
  },
  {
    id: "generate-all-visuals",
    title: "Generate all visuals at once",
    description:
      "One click generates visuals for every scene automatically. Motion graphics for data scenes, AI images for atmosphere, and searches for authority clips.",
    placement: "left",
    actionHint: "Click Generate All Visuals",
    requiresGate: true,
    path: "/projects/$projectId",
  },
  {
    id: "generate-all-voiceovers",
    title: "Generate voiceovers",
    description:
      "DocForge creates AI voiceovers for every scene using your chosen voice. Word-level timestamps sync captions automatically.",
    placement: "left",
    actionHint: "Click Generate All Voiceovers",
    path: "/projects/$projectId",
  },
  {
    id: "export-package",
    title: "Export your production package",
    description:
      "When you're ready, export everything — the assembly manifest, voiceover files, visual references, captions, and metadata — in one zip file ready for editing.",
    placement: "bottom",
    path: "/projects/$projectId",
  },
];

export const TOTAL_STEPS = WALKTHROUGH_STEPS.length;
