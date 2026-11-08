/**
 * Captures a MediaStream as 16 kHz mono 16-bit PCM, the format the Gnani streaming and REST
 * APIs expect. Runs in an AudioWorklet (off the main thread) and downsamples by averaging.
 */
export interface PcmCapture {
  stop(): void;
}

const WORKLET_SOURCE = `
class PcmDownsampler extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.ratio = sampleRate / options.processorOptions.targetRate;
    this.acc = 0; this.count = 0; this.pos = 0; this.idx = 0;
    this.out = new Int16Array(1024);
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      this.acc += ch[i]; this.count++; this.pos += 1;
      if (this.pos >= this.ratio) {
        const v = Math.max(-1, Math.min(1, this.acc / this.count));
        this.out[this.idx++] = v < 0 ? v * 32768 : v * 32767;
        this.acc = 0; this.count = 0; this.pos -= this.ratio;
        if (this.idx >= this.out.length) {
          this.port.postMessage(this.out.slice(0, this.idx).buffer);
          this.idx = 0;
        }
      }
    }
    if (this.idx > 0 && this.idx >= 256) {
      this.port.postMessage(this.out.slice(0, this.idx).buffer);
      this.idx = 0;
    }
    return true;
  }
}
registerProcessor('pcm-downsampler', PcmDownsampler);
`;

export async function createPcmCapture(
  stream: MediaStream,
  onFrame: (pcm: Int16Array) => void,
  targetRate = 16000,
): Promise<PcmCapture> {
  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx || typeof AudioWorkletNode === 'undefined') {
    throw new Error('This browser cannot capture raw audio (AudioWorklet unavailable).');
  }
  const ctx = new Ctx();
  const url = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: 'application/javascript' }));
  try {
    await ctx.audioWorklet.addModule(url);
  } finally {
    URL.revokeObjectURL(url);
  }
  const source = ctx.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(ctx, 'pcm-downsampler', {
    processorOptions: { targetRate },
    numberOfOutputs: 0,
  });
  node.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
    onFrame(new Int16Array(event.data));
  };
  source.connect(node);
  return {
    stop() {
      node.port.onmessage = null;
      source.disconnect();
      node.disconnect();
      void ctx.close();
    },
  };
}
