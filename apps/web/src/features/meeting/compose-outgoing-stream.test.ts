import { describe, expect, it } from 'vitest';
import { composeOutgoingStream } from './compose-outgoing-stream';

const track = (kind: 'audio' | 'video', id: string) =>
  ({ kind, id }) as unknown as MediaStreamTrack;
const stream = (tracks: MediaStreamTrack[]) =>
  ({
    getAudioTracks: () => tracks.filter((t) => t.kind === 'audio'),
    getVideoTracks: () => tracks.filter((t) => t.kind === 'video'),
    tracks,
  }) as unknown as MediaStream & { tracks: MediaStreamTrack[] };
const make = (tracks: MediaStreamTrack[]) => stream(tracks);

describe('composeOutgoingStream', () => {
  const mic = track('audio', 'mic');
  const camera = track('video', 'camera');
  const display = track('video', 'display');
  const local = stream([camera, mic]);

  it('sends the local stream unchanged when nothing is being shared', () => {
    expect(composeOutgoingStream(local, null, make)).toBe(local);
    expect(composeOutgoingStream(null, null, make)).toBeNull();
  });

  it('keeps the microphone while the screen replaces the camera video', () => {
    const out = composeOutgoingStream(local, stream([display]), make) as unknown as {
      tracks: MediaStreamTrack[];
    };
    expect(out.tracks.map((t) => t.id).sort()).toEqual(['display', 'mic']);
  });

  it('still shares the screen when the user has no local media at all', () => {
    const out = composeOutgoingStream(null, stream([display]), make) as unknown as {
      tracks: MediaStreamTrack[];
    };
    expect(out.tracks.map((t) => t.id)).toEqual(['display']);
  });

  it('falls back to capture audio only when there is no microphone', () => {
    const tabAudio = track('audio', 'tab-audio');
    const out = composeOutgoingStream(
      stream([camera]),
      stream([display, tabAudio]),
      make,
    ) as unknown as {
      tracks: MediaStreamTrack[];
    };
    expect(out.tracks.map((t) => t.id).sort()).toEqual(['display', 'tab-audio']);
  });
});
