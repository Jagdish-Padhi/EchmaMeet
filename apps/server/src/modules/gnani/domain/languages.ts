/**
 * Language and voice catalogue for the Gnani speech APIs.
 * Source: docs.gnani.ai (STT supported languages, TTS available voices).
 */

export const GNANI_LANGUAGES = [
  { code: 'en-IN', name: 'English', native: 'English' },
  { code: 'hi-IN', name: 'Hindi', native: 'हिन्दी' },
  { code: 'ta-IN', name: 'Tamil', native: 'தமிழ்' },
  { code: 'te-IN', name: 'Telugu', native: 'తెలుగు' },
  { code: 'kn-IN', name: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ml-IN', name: 'Malayalam', native: 'മലയാളം' },
  { code: 'mr-IN', name: 'Marathi', native: 'मराठी' },
  { code: 'bn-IN', name: 'Bengali', native: 'বাংলা' },
  { code: 'gu-IN', name: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'pa-IN', name: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
] as const;

export type GnaniLanguageCode = (typeof GNANI_LANGUAGES)[number]['code'];

/** Prisma v3.0 can identify the language itself. */
export const AUTO_LANGUAGE = 'indic-auto';

const LANGUAGE_SET: ReadonlySet<string> = new Set(GNANI_LANGUAGES.map((l) => l.code));

export function isGnaniLanguage(code: string): code is GnaniLanguageCode {
  return LANGUAGE_SET.has(code);
}

/**
 * Validates a `language_code` value: `indic-auto`, or one to four distinct supported codes
 * separated by commas (Prisma v3.0 limit). Returns the normalised value or throws.
 */
export function normalizeLanguageSelection(input: string | undefined): string {
  const value = (input ?? '').trim();
  if (value === '') return AUTO_LANGUAGE;
  if (value === AUTO_LANGUAGE) return value;
  const parts = [
    ...new Set(
      value
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean),
    ),
  ];
  if (parts.length === 0 || parts.length > 4) {
    throw new RangeError('language_code accepts indic-auto or 1 to 4 language codes.');
  }
  for (const part of parts) {
    if (!isGnaniLanguage(part)) {
      throw new RangeError(`Unsupported language code "${part}".`);
    }
  }
  return parts.join(',');
}

/** Preferred Timbre v2.5 voice per language (each v2.5 voice has one preferred language). */
export const TIMBRE_V25_VOICES: Readonly<Record<GnaniLanguageCode, string>> = {
  'en-IN': 'Kaveri',
  'hi-IN': 'Nalini',
  'ta-IN': 'Trisha',
  'te-IN': 'Suhana',
  'kn-IN': 'Saanvi',
  'ml-IN': 'Reshma',
  'mr-IN': 'Zahira',
  'bn-IN': 'Kirra',
  'gu-IN': 'Falak',
  'pa-IN': 'Mehuli',
};

/** Timbre v3.0 voices speak all ten languages; this one is the warm support persona. */
export const TIMBRE_V30_DEFAULT_VOICE = 'Shivani';

export type TtsModel = 'timbre-v2.5' | 'timbre-v3.0';

export function resolveVoice(
  model: TtsModel,
  language: GnaniLanguageCode,
  override?: string,
): string {
  if (override && override.trim() !== '') return override.trim();
  return model === 'timbre-v3.0' ? TIMBRE_V30_DEFAULT_VOICE : TIMBRE_V25_VOICES[language];
}

const SCRIPT_RANGES: readonly { readonly re: RegExp; readonly language: GnaniLanguageCode }[] = [
  { re: /[\u0900-\u097F]/g, language: 'hi-IN' },
  { re: /[\u0B80-\u0BFF]/g, language: 'ta-IN' },
  { re: /[\u0C00-\u0C7F]/g, language: 'te-IN' },
  { re: /[\u0C80-\u0CFF]/g, language: 'kn-IN' },
  { re: /[\u0D00-\u0D7F]/g, language: 'ml-IN' },
  { re: /[\u0980-\u09FF]/g, language: 'bn-IN' },
  { re: /[\u0A80-\u0AFF]/g, language: 'gu-IN' },
  { re: /[\u0A00-\u0A7F]/g, language: 'pa-IN' },
];

/**
 * Best-effort script-based language tag, used when the STT response carries no
 * `detected_language_code` (for example Prisma v2.5). Devanagari maps to Hindi because Hindi
 * and Marathi share the script; callers that know better should pass the language explicitly.
 */
export function detectLanguageFromScript(text: string): GnaniLanguageCode | undefined {
  let best: { language: GnaniLanguageCode; count: number } | undefined;
  for (const { re, language } of SCRIPT_RANGES) {
    const count = text.match(re)?.length ?? 0;
    if (count > 0 && (!best || count > best.count)) best = { language, count };
  }
  const latin = text.match(/[A-Za-z]/g)?.length ?? 0;
  if (best && best.count >= latin * 0.3) return best.language;
  return latin > 0 ? 'en-IN' : undefined;
}
