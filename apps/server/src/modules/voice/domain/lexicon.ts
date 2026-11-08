/**
 * Spoken-command lexicon for English, Hindi (Devanagari) and Hinglish (romanised Hindi).
 * Adding a language is a data change here plus reply templates in `replies.ts`.
 */

const DEVANAGARI_DIGITS = '०१२३४५६७८९';

/** Hindi number words that are unambiguous in mixed speech. "do" (two) is excluded on purpose:
 *  in Hinglish it is far more often the imperative ("rok do"). */
const NUMBER_WORDS: Readonly<Record<string, number>> = {
  एक: 1,
  ek: 1,
  दो: 2,
  तीन: 3,
  teen: 3,
  चार: 4,
  char: 4,
  पाँच: 5,
  पांच: 5,
  paanch: 5,
  panch: 5,
  छह: 6,
  छः: 6,
  chhe: 6,
  chhah: 6,
  सात: 7,
  saat: 7,
  आठ: 8,
  aath: 8,
  नौ: 9,
  nau: 9,
  दस: 10,
  das: 10,
  बीस: 20,
  bees: 20,
  तीस: 30,
  tees: 30,
  चालीस: 40,
  chalis: 40,
  पचास: 50,
  pachas: 50,
  साठ: 60,
  saath: 60,
  सत्तर: 70,
  sattar: 70,
  अस्सी: 80,
  assi: 80,
  नब्बे: 90,
  nabbe: 90,
};
const HUNDRED = new Set(['सौ', 'sau', 'सो']);
const THOUSAND = new Set(['हज़ार', 'हजार', 'hazaar', 'hazar']);

/** Common service names a Hindi speaker says in Devanagari, mapped to the Latin id/label. */
const SERVICE_ALIASES: Readonly<Record<string, string>> = {
  गेटवे: 'gateway',
  बैकएंड: 'backend',
  बैकेंड: 'backend',
  डेटाबेस: 'database',
  डाटाबेस: 'database',
  पेमेंट: 'payment',
  ऑर्डर: 'order',
  कैश: 'cache',
  क्यू: 'queue',
  सर्विस: 'service',
  ऑथ: 'auth',
  यूज़र: 'user',
  इन्वेंटरी: 'inventory',
  नोटिफिकेशन: 'notification',
  लोडबैलेंसर: 'loadbalancer',
  एपीआई: 'api',
};

export function normalizeSpeech(text: string): string {
  let out = text.normalize('NFC');
  out = out.replace(/[०-९]/g, (d) => String(DEVANAGARI_DIGITS.indexOf(d)));
  for (const [hi, latin] of Object.entries(SERVICE_ALIASES)) {
    out = out.split(hi).join(latin);
  }
  return replaceNumberWords(out);
}

function replaceNumberWords(text: string): string {
  const tokens = text.split(/(\s+)/);
  const result: string[] = [];
  let run: { total: number; current: number; words: number } | undefined;
  const flush = (): void => {
    if (run) {
      result.push(String(run.total + run.current));
      run = undefined;
    }
  };
  for (const token of tokens) {
    const word = token.toLowerCase();
    if (/^\s+$/.test(token)) {
      if (!run) result.push(token);
      continue;
    }
    const unit = NUMBER_WORDS[word];
    if (unit !== undefined) {
      run ??= { total: 0, current: 0, words: 0 };
      run.current += unit;
      run.words += 1;
    } else if (run && HUNDRED.has(word)) {
      run.current = (run.current === 0 ? 1 : run.current) * 100;
    } else if (run && THOUSAND.has(word)) {
      run.total += (run.current === 0 ? 1 : run.current) * 1000;
      run.current = 0;
    } else {
      flush();
      result.push(token);
    }
  }
  flush();
  return result.join('').replace(/(\d)\s{2,}/g, '$1 ');
}

export const LEXICON = {
  cancel: [
    'cancel',
    'abort',
    'stop',
    'रद्द',
    'रोको',
    'रोक दो',
    'रुको',
    'radd karo',
    'rok do',
    'roko',
    'ruko',
  ],
  experimentNoun: [
    'experiment',
    'एक्सपेरिमेंट',
    'प्रयोग',
    'resilience',
    'रेज़िलिएंस',
    'test',
    'टेस्ट',
  ],
  repairNoun: ['repair', 'रिपेयर', 'मरम्मत', 'सुधार', 'theek', 'ठीक'],
  startVerb: [
    'start',
    'run',
    'begin',
    'शुरू',
    'शुरु',
    'चालू',
    'चला',
    'shuru',
    'chalu',
    'chala',
    'chalao',
    'karo',
    'करो',
    'kar do',
    'कर दो',
  ],
  scenario: ['scenario', 'सीनेरियो', 'परिदृश्य', 'senario'],
  invariant: ['invariant', 'threshold', 'requirement', 'इनवेरिएंट', 'थ्रेशोल्ड', 'सीमा', 'seema'],
  fault: [
    'inject',
    'fault',
    'latency',
    'stall',
    'delay',
    'break',
    'reset',
    'इंजेक्ट',
    'फॉल्ट',
    'लेटेंसी',
    'देरी',
    'धीमा',
    'dheema',
    'deri',
    'स्टॉल',
    'रीसेट',
    'तोड़',
    'tod do',
    'down',
    'डाउन',
  ],
  stall: ['stall', 'स्टॉल', 'अटक', 'hang', 'freeze'],
  reset: ['reset', 'रीसेट'],
  down: ['down', 'डाउन', 'बंद हो', 'band ho', 'crash', 'क्रैश'],
  errorRate: ['error rate', 'एरर रेट', 'त्रुटि दर', 'error ka rate'],
  completionRate: ['completion rate', 'कंप्लीशन रेट', 'पूर्णता दर', 'completion ka rate'],
  retryAmplification: ['retry amplification', 'रिट्राई एम्प्लीफिकेशन'],
  ruleBased: ['rule', 'baseline', 'रूल', 'बेसलाइन'],
  trials: ['trial', 'trials', 'ट्रायल', 'बार', 'baar'],
  milliseconds: ['ms', 'millisecond', 'milliseconds', 'मिलीसेकंड', 'मिली सेकंड', 'मिलीसेकेंड'],
  seconds: ['sec', 'secs', 'second', 'seconds', 'सेकंड', 'सेकेंड', 'सेकण्ड'],
} as const;

export function hasAny(haystack: string, terms: readonly string[]): boolean {
  return terms.some((t) => haystack.includes(t));
}
