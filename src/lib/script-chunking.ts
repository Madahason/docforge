export const WORDS_PER_CHUNK = 500;

export function countScriptWords(script: string) {
  const trimmed = script.trim();
  return trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
}

export function splitScriptIntoChunks(script: string): string[] {
  const paragraphs = script
    .split(/\n\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const units = paragraphs.length ? paragraphs : [script.trim()].filter(Boolean);
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentWordCount = 0;

  for (const paragraph of units) {
    const paragraphWords = countScriptWords(paragraph);
    if (currentWordCount + paragraphWords > WORDS_PER_CHUNK && currentChunk.length > 0) {
      chunks.push(currentChunk.join("\n\n"));
      currentChunk = [paragraph];
      currentWordCount = paragraphWords;
    } else {
      currentChunk.push(paragraph);
      currentWordCount += paragraphWords;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join("\n\n"));
  }

  return chunks;
}
