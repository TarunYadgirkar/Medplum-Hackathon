export const EMERGENCY_KEYWORDS = [
  "can't breathe",
  "cannot breathe",
  "chest pain",
  "heart attack",
  "not responding",
  "unconscious",
  "severe bleeding",
  "stroke",
  "shortness of breath",
  "trouble breathing",
  "difficulty breathing",
  "can't catch my breath",
  "passing out",
  "passed out",
  "loss of consciousness",
  "lose consciousness",
  "seizure",
  "overdose",
  "anaphylaxis",
  "allergic reaction",
  "severe abdominal pain",
  "coughing up blood",
  "numb",
  "slurred speech",
];

export const NEGATION_WORDS = [
  "no",
  "not",
  "denies",
  "denying",
  "without",
  "never",
  "negative for",
];

const RESOLUTION_PHRASES = [
  "no longer",
  "resolved",
  "went away",
  "stopped",
];

// Only considers Patient:-labelled turns; falls back to full transcript when no
// speaker labels are present. Ignores the assistant's own screening questions
// which repeat emergency keywords verbatim.
export function extractPatientText(transcript: string): string {
  const matches = transcript.match(/patient:([^]*?)(?=\n\s*\w+:|$)/gi);
  if (!matches) return transcript;
  return matches.join("\n");
}

// Word-boundary negation check so "cannot" or "nobody" don't spuriously match
// "not" or "no". Also treats a keyword as resolved when a resolution phrase
// follows it within the same clause (up to ~8 words after the match).
export function hasEmergencyIndicator(transcript: string): boolean {
  const lower = extractPatientText(transcript).toLowerCase();

  return EMERGENCY_KEYWORDS.some((keyword) => {
    let fromIndex = 0;
    while (true) {
      const matchIndex = lower.indexOf(keyword, fromIndex);
      if (matchIndex === -1) return false;

      const clauseStart = Math.max(
        lower.lastIndexOf(".", matchIndex),
        lower.lastIndexOf(",", matchIndex),
        lower.lastIndexOf("\n", matchIndex)
      );
      const clauseBefore = lower.slice(clauseStart + 1, matchIndex);

      const negated = NEGATION_WORDS.some((neg) => {
        const negRegex = new RegExp(`\\b${neg.replace(/ /g, "\\s+")}\\b`);
        return negRegex.test(clauseBefore);
      });

      if (!negated) {
        // Check for resolution phrases in the ~60 chars following the keyword
        const afterKeyword = lower.slice(
          matchIndex + keyword.length,
          matchIndex + keyword.length + 60
        );
        const resolved = RESOLUTION_PHRASES.some((phrase) =>
          afterKeyword.includes(phrase)
        );
        if (!resolved) return true;
      }

      fromIndex = matchIndex + keyword.length;
    }
  });
}
