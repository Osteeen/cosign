// Matching an agent's product search against catalog text: plain words, no
// AI. A product must share most of the query's words to count as a match.

const STOP = new Set(["the", "and", "for", "with", "some", "any", "buy", "get", "need", "our", "office", "pack", "of", "a", "an"]);

// Plain plurals only: notes -> note, pens -> pen, boxes -> box, glasses -> glass.
export function singular(w: string): string {
  if (/(x|ss|ch|sh)es$/.test(w)) return w.slice(0, -2);
  if (/[^s]s$/.test(w) && w.length > 3) return w.slice(0, -1);
  return w;
}

export function queryWords(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !STOP.has(w))
    .map(singular);
}

// How many of the query's words the text contains.
export function matchScore(wanted: readonly string[], text: string): number {
  const have = new Set(queryWords(text));
  return wanted.filter((w) => have.has(w)).length;
}

// Both of two words, two of three, three of four...
export function minimumScore(wanted: readonly string[]): number {
  return Math.max(1, Math.ceil(wanted.length * 0.6));
}
