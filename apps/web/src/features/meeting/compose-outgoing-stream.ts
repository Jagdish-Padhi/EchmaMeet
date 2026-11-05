/**
 * Builds the stream that is sent to remote peers.
 *
 * A screen capture normally carries video only. Sending it *instead of* the local stream would
 * silently drop the microphone for the duration of the share, so the outgoing stream is composed:
 * the shared screen replaces the camera video, and the microphone keeps flowing.
 */
export interface TrackSource {
  getAudioTracks(): MediaStreamTrack[];
  getVideoTracks(): MediaStreamTrack[];
}

export function composeOutgoingStream(
  local: (TrackSource & MediaStream) | null,
  screen: (TrackSource & MediaStream) | null,
  createStream: (tracks: MediaStreamTrack[]) => MediaStream = (tracks) => new MediaStream(tracks),
): MediaStream | null {
  if (!screen) return local;

  const screenVideo = screen.getVideoTracks();
  // Prefer the microphone from the local stream; fall back to any audio the capture itself has.
  const audio = local?.getAudioTracks() ?? [];
  const audioTracks = audio.length > 0 ? audio : screen.getAudioTracks();
  const videoTracks = screenVideo.length > 0 ? screenVideo : (local?.getVideoTracks() ?? []);

  const tracks = [...videoTracks, ...audioTracks];
  if (tracks.length === 0) return local;
  return createStream(tracks);
}
