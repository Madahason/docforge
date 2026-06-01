import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export const createGoogleAIProvider = (apiKey: string) =>
  createOpenAICompatible({
    name: "google",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
