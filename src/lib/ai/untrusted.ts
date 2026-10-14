// Helpers for untrusted text (agent purposes, item names, web pages, other
// retailers' titles) that reaches the AI checks or the owner.

// JSON for a prompt's data block, with < and > escaped so no string inside can
// close the block's tag and pose as instructions.
export function dataJson(value: unknown, space?: number): string {
  return JSON.stringify(value, null, space).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
}

// Phrases aimed at an AI rather than at a person: a purchase carrying them is
// sent to the owner without asking the model (it can't be talked out of it).
const AIMED_AT_AI = [
  /\bignore (all |any )?(the )?(previous|prior|above|earlier) (instructions|rules|messages)\b/i,
  /\b(do not|don't|dont|no need to) (wait|ask|check) (for|with) (the )?(owner|approval|permission|user|human)\b/i,
  /\bwithout (asking|approval|waiting|checking)\b/i,
  /\b(skip|bypass|override) (the )?(approval|owner|rules?|limits?|checks?)\b/i,
  /\b(you are|as) an? (ai|llm|language model|assistant|agent)\b/i,
  /\bsystem prompt\b/i,
  /\bbuy \d{2,} (units?|now)\b/i,
];

export function aimedAtAi(texts: string[]): string | null {
  for (const t of texts) {
    for (const re of AIMED_AT_AI) {
      const m = re.exec(t);
      if (m) return m[0];
    }
  }
  return null;
}

// Agent-written text shown in emails: mail apps turn bare addresses into
// links, so links an agent wrote are removed.
export const withoutLinks = (s: string) => s.replace(/\b(?:https?:\/\/|www\.)\S+/gi, "[link removed]");
