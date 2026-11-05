/* eslint-disable @typescript-eslint/no-deprecated -- ScriptProcessorNode is used only as the
   fallback for engines without AudioWorklet support. */
import {
  SpeechSegmenter,
  STT_SAMPLE_RATE,
  bytesToBase64,
  encodeWavPcm16,
  resampleLinear,
} from './pcm';

export interface PcmCaptureHandle {
  /** Stops capture and returns any utterance still in progress as base64 WAV. */
  stop(): string | null;
}

const WORKLET_SOURCE = `
class CaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel && channel.length) this.port.postMessage(channel.slice(0));
    return true;
  }
}
registerProcessor('chaosboard-capture', CaptureProcessor);
`;

function toBase64Wav(samples: Float32Array, sampleRate: number): string {
  const resampled = resampleLinear(samples, sampleRate, STT_SAMPLE_RATE);
  return bytesToBase64(new Uint8Array(encodeWavPcm16(resampled, STT_SAMPLE_RATE)));
}

/**
 * Captures microphone PCM from a MediaStream, segments it into utterances, and hands each one
 * over as a 16 kHz mono PCM16 WAV (the format Muse Voice Transcribe accepts). Uses an
 * AudioWorklet and falls back to ScriptProcessor on engines without worklet support.
 */
export async function startPcmCapture(
  stream: MediaStream,
  onUtterance: (wavBase64: string) => void,
): Promise<PcmCaptureHandle> {
  const AudioContextCtor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) throw new Error('Web Audio is not supported in this browser.');

  const context = new AudioContextCtor();
  const segmenter = new SpeechSegmenter({ sampleRate: context.sampleRate });
  const source = context.createMediaStreamSource(stream);
  const handleFrame = (frame: Float32Array) => {
    for (const utterance of segmenter.push(frame)) {
      onUtterance(toBase64Wav(utterance, context.sampleRate));
    }
  };

  let teardown: () => void;
  if (context.audioWorklet) {
    const url = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: 'application/javascript' }));
    await context.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    const node = new AudioWorkletNode(context, 'chaosboard-capture');
    node.port.onmessage = (event: MessageEvent<Float32Array>) => {
      handleFrame(event.data);
    };
    source.connect(node);
    teardown = () => {
      node.port.onmessage = null;
      source.disconnect();
      node.disconnect();
    };
  } else {
    const processor = context.createScriptProcessor(2048, 1, 1);
    processor.onaudioprocess = (event) => {
      handleFrame(new Float32Array(event.inputBuffer.getChannelData(0)));
    };
    source.connect(processor);
    processor.connect(context.destination);
    teardown = () => {
      processor.onaudioprocess = null;
      source.disconnect();
      processor.disconnect();
    };
  }

  return {
    stop() {
      teardown();
      const tail = segmenter.flush();
      const result = tail ? toBase64Wav(tail, context.sampleRate) : null;
      void context.close();
      return result;
    },
  };
}

/**
 * Records everything until stopped (push-to-talk) and returns a single 16 kHz mono PCM16 WAV
 * as base64. Used by the voice-command flow, where the user's key press delimits the utterance.
 */
export async function startPcmRecording(stream: MediaStream): Promise<{ stop(): string | null }> {
  const frames: Float32Array[] = [];
  let sampleRate = 48_000;
  const AudioContextCtor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) throw new Error('Web Audio is not supported in this browser.');
  const context = new AudioContextCtor();
  sampleRate = context.sampleRate;
  const source = context.createMediaStreamSource(stream);
  let teardown: () => void;
  if (context.audioWorklet) {
    const url = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: 'application/javascript' }));
    await context.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    const node = new AudioWorkletNode(context, 'chaosboard-capture');
    node.port.onmessage = (event: MessageEvent<Float32Array>) => {
      frames.push(event.data);
    };
    source.connect(node);
    teardown = () => {
      node.port.onmessage = null;
      source.disconnect();
      node.disconnect();
    };
  } else {
    const processor = context.createScriptProcessor(2048, 1, 1);
    processor.onaudioprocess = (event) => {
      frames.push(new Float32Array(event.inputBuffer.getChannelData(0)));
    };
    source.connect(processor);
    processor.connect(context.destination);
    teardown = () => {
      processor.onaudioprocess = null;
      source.disconnect();
      processor.disconnect();
    };
  }
  return {
    stop() {
      teardown();
      void context.close();
      const total = frames.reduce((n, f) => n + f.length, 0);
      if (total === 0) return null;
      const merged = new Float32Array(total);
      let offset = 0;
      for (const f of frames) {
        merged.set(f, offset);
        offset += f.length;
      }
      return toBase64Wav(merged, sampleRate);
    },
  };
}
