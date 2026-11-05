import { describe, expect, it } from 'vitest';
import { isQuoteGrounded } from '../quote-grounding';

const transcript = [
  { speakerName: 'Alex Chen', text: 'The payment service is stalling downstream calls, honestly.' },
  { speakerName: 'Bob', text: 'We should add a circuit breaker on the inventory edge.' },
];

describe('isQuoteGrounded', () => {
  it('accepts exact quotes, ignoring case and punctuation', () => {
    expect(
      isQuoteGrounded('payment service is stalling downstream calls', 'alex chen', transcript),
    ).toBe(true);
    expect(
      isQuoteGrounded('The Payment Service is stalling downstream calls!', 'Alex Chen', transcript),
    ).toBe(true);
  });

  it('rejects a quote built from one real keyword plus invented words', () => {
    expect(
      isQuoteGrounded('the payment team will rewrite everything tomorrow', 'Alex Chen', transcript),
    ).toBe(false);
    expect(isQuoteGrounded('zebra unicorn payment', 'Alex Chen', transcript)).toBe(false);
  });

  it('rejects a real sentence attributed to the wrong person', () => {
    expect(
      isQuoteGrounded(
        'we should add a circuit breaker on the inventory edge',
        'Alex Chen',
        transcript,
      ),
    ).toBe(false);
    expect(
      isQuoteGrounded('we should add a circuit breaker on the inventory edge', 'Bob', transcript),
    ).toBe(true);
  });

  it('rejects unknown speakers and empty quotes', () => {
    expect(isQuoteGrounded('payment service', 'Mallory', transcript)).toBe(false);
    expect(isQuoteGrounded('   ', 'Alex Chen', transcript)).toBe(false);
  });

  it('tolerates trimming a long quote but not short fuzzy matches', () => {
    expect(
      isQuoteGrounded(
        'um the payment service is stalling downstream calls honestly yes',
        'Alex Chen',
        transcript,
      ),
    ).toBe(true);
    expect(isQuoteGrounded('payment stalling', 'Alex Chen', transcript)).toBe(false);
  });
});
