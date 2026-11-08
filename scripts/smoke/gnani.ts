/**
 * Gnani smoke test: a Timbre -> Prisma round trip.
 *
 * Speaks a Hindi/Hinglish command with Gnani Timbre TTS, feeds the audio straight back into
 * Gnani Prisma STT, and prints what was heard plus the latency of each hop. A working key,
 * working voices and a working transcription path all show up in one run.
 *
 * Environment: GNANI_API_KEY (required). Optional: GNANI_BASE_URL (default https://api.vachana.ai),
 * GNANI_STT_MODEL (prisma-v3.0), GNANI_TTS_MODEL (timbre-v2.5).
 *
 *   pnpm smoke:gnani
 */
import { z } from 'zod';

const env = z
  .object({
    GNANI_API_KEY: z.string().min(1, 'Set GNANI_API_KEY in .env (from app.gnani.ai/voice)'),
    GNANI_BASE_URL: z.url().default('https://api.vachana.ai'),
    GNANI_STT_MODEL: z.string().default('prisma-v3.0'),
    GNANI_TTS_MODEL: z.string().default('timbre-v2.5'),
  })
  .parse(process.env);

const base = env.GNANI_BASE_URL.replace(/\/$/, '');
const headers = { 'X-API-Key-ID': env.GNANI_API_KEY };

const CASES = [
  {
    language: 'hi-IN',
    voice: 'Nalini',
    text: 'gateway से backend पर तीन सौ मिलीसेकंड latency inject करो',
  },
  {
    language: 'en-IN',
    voice: 'Kaveri',
    text: 'Inject three hundred milliseconds latency on the gateway to backend link',
  },
] as const;

async function main(): Promise<void> {
  let failed = false;
  for (const c of CASES) {
    const t0 = performance.now();
    const tts = await fetch(`${base}/api/v1/tts/inference`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: c.text,
        voice: c.voice,
        model: env.GNANI_TTS_MODEL,
        language: c.language,
        audio_config: {
          sample_rate: 16000,
          num_channels: 1,
          sample_width: 2,
          encoding: 'linear_pcm',
          container: 'wav',
        },
      }),
    });
    const ttsMs = Math.round(performance.now() - t0);
    if (!tts.ok) {
      console.error(`TTS ${c.language} failed: HTTP ${String(tts.status)} ${await tts.text()}`);
      failed = true;
      continue;
    }
    const audio = await tts.arrayBuffer();

    const form = new FormData();
    form.append('audio_file', new Blob([audio], { type: 'audio/wav' }), 'smoke.wav');
    form.append('model', env.GNANI_STT_MODEL);
    form.append('language_code', c.language);
    form.append('format', 'transcribe');
    const t1 = performance.now();
    const stt = await fetch(`${base}/stt/v3`, { method: 'POST', headers, body: form });
    const sttMs = Math.round(performance.now() - t1);
    const body = (await stt.json().catch(() => ({}))) as { success?: boolean; transcript?: string };
    if (!stt.ok || body.success === false) {
      console.error(`STT ${c.language} failed: HTTP ${String(stt.status)} ${JSON.stringify(body)}`);
      failed = true;
      continue;
    }
    console.log(
      `[${c.language}] voice=${c.voice} tts=${String(ttsMs)}ms (${String(audio.byteLength)} bytes) stt=${String(sttMs)}ms`,
    );
    console.log(`  said : ${c.text}`);
    console.log(`  heard: ${body.transcript ?? ''}`);
  }
  if (failed) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
