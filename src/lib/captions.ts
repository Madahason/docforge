// Pure (no API) caption helpers. Built from ElevenLabs word timestamps already
// stored in the voiceovers table. Used by the Captions tab in the studio.

export type WordTs = { word: string; start: number; end: number; confidence?: number };

export type CaptionLine = {
  text: string;
  start: number;
  end: number;
  line_number: number;
};

export type StylePresetId = "documentary" | "bold_impact" | "broadcast" | "kinetic" | "minimal";

export type CaptionStyle = {
  font_size: number;
  font_weight: "normal" | "bold" | "extra-bold";
  text_color: string;
  background: "none" | "dark_bar" | "dark_box" | "blur";
  background_opacity: number; // 0-1
  position: "top" | "center" | "bottom";
  horizontal: "left" | "center" | "right";
  text_shadow: "none" | "soft" | "hard";
  letter_spacing: "normal" | "wide";
};

export const STYLE_PRESETS: Record<
  StylePresetId,
  { label: string; description: string; style: CaptionStyle }
> = {
  documentary: {
    label: "Documentary",
    description: "White text, bottom center, clean",
    style: {
      font_size: 22,
      font_weight: "normal",
      text_color: "#f0f0f0",
      background: "none",
      background_opacity: 0,
      position: "bottom",
      horizontal: "center",
      text_shadow: "soft",
      letter_spacing: "normal",
    },
  },
  bold_impact: {
    label: "Bold Impact",
    description: "Large bold white text, centered",
    style: {
      font_size: 28,
      font_weight: "bold",
      text_color: "#ffffff",
      background: "none",
      background_opacity: 0,
      position: "center",
      horizontal: "center",
      text_shadow: "hard",
      letter_spacing: "normal",
    },
  },
  broadcast: {
    label: "Broadcast",
    description: "White text on dark bar at bottom",
    style: {
      font_size: 20,
      font_weight: "normal",
      text_color: "#ffffff",
      background: "dark_bar",
      background_opacity: 0.75,
      position: "bottom",
      horizontal: "center",
      text_shadow: "none",
      letter_spacing: "normal",
    },
  },
  kinetic: {
    label: "Kinetic",
    description: "Gold keyword highlight style",
    style: {
      font_size: 22,
      font_weight: "bold",
      text_color: "#ffffff",
      background: "none",
      background_opacity: 0,
      position: "bottom",
      horizontal: "center",
      text_shadow: "soft",
      letter_spacing: "wide",
    },
  },
  minimal: {
    label: "Minimal",
    description: "Small subtle text at bottom",
    style: {
      font_size: 18,
      font_weight: "normal",
      text_color: "#cccccc",
      background: "none",
      background_opacity: 0,
      position: "bottom",
      horizontal: "center",
      text_shadow: "soft",
      letter_spacing: "normal",
    },
  },
};

export const MAX_CHARS_PER_LINE = 42;
export const MAX_DURATION = 3.5;

export function buildCaptionLines(words: WordTs[]): CaptionLine[] {
  const lines: CaptionLine[] = [];
  let current: WordTs[] = [];
  let currentDuration = 0;

  for (const word of words) {
    const wordDuration = Math.max(0, word.end - word.start);
    const proposed = [...current, word].map((w) => w.word).join(" ");
    const tooLong = proposed.length > MAX_CHARS_PER_LINE;
    const tooSlow = currentDuration + wordDuration > MAX_DURATION;

    if ((tooLong || tooSlow) && current.length > 0) {
      lines.push({
        text: current.map((w) => w.word).join(" "),
        start: current[0].start,
        end: current[current.length - 1].end,
        line_number: lines.length + 1,
      });
      current = [word];
      currentDuration = wordDuration;
    } else {
      current.push(word);
      currentDuration += wordDuration;
    }
  }

  if (current.length > 0) {
    lines.push({
      text: current.map((w) => w.word).join(" "),
      start: current[0].start,
      end: current[current.length - 1].end,
      line_number: lines.length + 1,
    });
  }

  return lines;
}

export function formatSRTTime(seconds: number): string {
  const s = Math.max(0, seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

export function formatVTTTime(seconds: number): string {
  return formatSRTTime(seconds).replace(",", ".");
}

export function buildSRT(lines: CaptionLine[]): string {
  return lines
    .map(
      (line, i) =>
        `${i + 1}\n${formatSRTTime(line.start)} --> ${formatSRTTime(line.end)}\n${line.text}\n`,
    )
    .join("\n");
}

export function buildVTT(lines: CaptionLine[]): string {
  return (
    "WEBVTT\n\n" +
    lines
      .map(
        (line, i) =>
          `${i + 1}\n${formatVTTTime(line.start)} --> ${formatVTTTime(line.end)}\n${line.text}\n`,
      )
      .join("\n")
  );
}

export function renumber(lines: CaptionLine[]): CaptionLine[] {
  return lines
    .slice()
    .sort((a, b) => a.start - b.start)
    .map((line, i) => ({ ...line, line_number: i + 1 }));
}
