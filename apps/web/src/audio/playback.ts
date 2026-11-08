let current: HTMLAudioElement | null = null;

export function stopSpeech(): void {
  if (current) {
    current.pause();
    current = null;
  }
}

/** Plays base64 audio (Gnani Timbre returns WAV). Resolves when playback ends or fails. */
export function playBase64Audio(base64: string, contentType = 'audio/wav'): Promise<void> {
  stopSpeech();
  return new Promise((resolve) => {
    const audio = new Audio(`data:${contentType};base64,${base64}`);
    current = audio;
    const done = (): void => {
      if (current === audio) current = null;
      resolve();
    };
    audio.onended = done;
    audio.onerror = done;
    audio.play().catch(done);
  });
}
