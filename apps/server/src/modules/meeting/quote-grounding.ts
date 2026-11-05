/**
 * Evidence matching for quotes the language model attributes to meeting participants.
 *
 * A quote is accepted only if it can be found in what that participant actually said. The check is
 * deliberately strict: a single shared keyword is not evidence.
 */
export interface TranscriptLine {
  readonly speakerName: string;
  readonly text: string;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Longest run of consecutive quote tokens that appears contiguously in the haystack. */
function longestContiguousMatch(quoteTokens: readonly string[], haystack: string): number {
  const padded = ` ${haystack} `;
  let best = 0;
  for (let start = 0; start < quoteTokens.length; start += 1) {
    // Only extend past the current best: shorter windows cannot improve the result.
    for (let end = quoteTokens.length; end - start > best; end -= 1) {
      const phrase = quoteTokens.slice(start, end).join(' ');
      if (padded.includes(` ${phrase} `)) {
        best = end - start;
        break;
      }
    }
  }
  return best;
}

export function isQuoteGrounded(
  quote: string,
  speakerName: string,
  transcript: readonly TranscriptLine[],
  minCoverage = 0.8,
): boolean {
  const quoteNorm = normalize(quote);
  const speakerNorm = normalize(speakerName);
  if (quoteNorm.length === 0 || speakerNorm.length === 0) return false;

  const spoken = transcript
    .filter((line) => normalize(line.speakerName) === speakerNorm)
    .map((line) => normalize(line.text))
    .filter((text) => text.length > 0);
  if (spoken.length === 0) return false;

  const tokens = quoteNorm.split(' ');
  // Exact (normalised) containment within one utterance by that speaker is always sufficient.
  if (spoken.some((line) => ` ${line} `.includes(` ${quoteNorm} `))) return true;

  // Otherwise allow light paraphrase trimming, but only for quotes long enough to be meaningful:
  // most of the quote must survive as one contiguous phrase of a single utterance.
  if (tokens.length < 4) return false;
  const needed = Math.ceil(tokens.length * minCoverage);
  return spoken.some((line) => longestContiguousMatch(tokens, line) >= needed);
}
