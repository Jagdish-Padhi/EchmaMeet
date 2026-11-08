export type ReplyLanguage = 'en' | 'hi';

export function replyLanguageFor(code: string | undefined, transcript: string): ReplyLanguage {
  if (code?.startsWith('hi') || code?.startsWith('mr')) return 'hi';
  return /[\u0900-\u097F]/.test(transcript) ? 'hi' : 'en';
}

const FAULT_HI: Readonly<Record<string, string>> = {
  latency: 'लेटेंसी',
  stall: 'स्टॉल',
  connection_reset: 'कनेक्शन रीसेट',
  dependency_down: 'डिपेंडेंसी डाउन',
};

export const replies = {
  empty: (l: ReplyLanguage) =>
    l === 'hi'
      ? 'कुछ सुनाई नहीं दिया। कृपया दोबारा बोलिए।'
      : 'I did not catch that. Please speak again.',
  cancel: (l: ReplyLanguage) =>
    l === 'hi'
      ? 'चल रहा प्रयोग या रिपेयर रद्द किया जा रहा है।'
      : 'Cancelling the active experiment or repair.',
  experiment: (l: ReplyLanguage, trials: number) =>
    l === 'hi'
      ? `केऑस प्रयोग शुरू हो रहा है, ${String(trials)} ट्रायल।`
      : `Starting the chaos experiment with ${String(trials)} trials.`,
  repair: (l: ReplyLanguage, ruleBased: boolean) =>
    l === 'hi'
      ? `${ruleBased ? 'रूल बेस्ड' : 'ऑटोनॉमस'} रिपेयर शुरू हो रहा है, अधिकतम तीन पुनरावृत्तियाँ।`
      : `Starting the ${ruleBased ? 'rule-based' : 'autonomous'} repair loop, up to three iterations.`,
  scenario: (l: ReplyLanguage, id: string) =>
    l === 'hi'
      ? `सीनेरियो ${id} कैनवास पर लोड हो रहा है।`
      : `Loading scenario ${id} onto the canvas.`,
  invariant: (l: ReplyLanguage, metric: string, comparator: string, threshold: number) =>
    l === 'hi'
      ? `इनवेरिएंट सेट हुआ: ${metric} ${comparator} ${String(threshold)}।`
      : `Invariant set: ${metric} ${comparator} ${String(threshold)}.`,
  fault: (l: ReplyLanguage, source: string, target: string, type: string, latencyMs?: number) =>
    l === 'hi'
      ? `${source} से ${target} लिंक पर ${FAULT_HI[type] ?? type} फॉल्ट डाला जा रहा है${latencyMs ? `, ${String(latencyMs)} मिलीसेकंड` : ''}।`
      : `Injecting ${type.replace('_', ' ')} on the ${source} to ${target} link${latencyMs ? `, ${String(latencyMs)} milliseconds` : ''}.`,
  ambiguous: (l: ReplyLanguage) =>
    l === 'hi'
      ? 'कई लिंक मेल खाते हैं। कृपया सोर्स और टारगेट दोनों बताइए।'
      : 'More than one link matches. Please name both the source and the target.',
  noEdge: (l: ReplyLanguage) =>
    l === 'hi'
      ? 'इस नाम का कोई लिंक कैनवास पर नहीं मिला।'
      : 'I could not find that link on the canvas.',
  unsupported: (l: ReplyLanguage) =>
    l === 'hi'
      ? 'यह कमांड समझ नहीं आया। कहिए: फॉल्ट इंजेक्ट करो, एक्सपेरिमेंट चलाओ, या रिपेयर शुरू करो।'
      : 'I did not understand that command. Try: inject latency, run experiment, or start repair.',
};
