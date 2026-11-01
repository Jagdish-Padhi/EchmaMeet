export interface TranscriptSegment {
  readonly id: string;
  readonly roomId: string;
  readonly speakerId: string;
  readonly speakerName: string;
  readonly text: string;
  readonly timestampMs: number;
  readonly durationMs: number;
}

export class TranscriptStore {
  private readonly roomSegments = new Map<string, TranscriptSegment[]>();
  private readonly seenChunkIds = new Set<string>();

  addSegment(segment: TranscriptSegment): boolean {
    if (this.seenChunkIds.has(segment.id)) {
      return false; // Prevent duplicate transcript segments after retries
    }
    this.seenChunkIds.add(segment.id);
    if (this.seenChunkIds.size > 5000) {
      const first = this.seenChunkIds.values().next().value;
      if (first) this.seenChunkIds.delete(first);
    }

    let list = this.roomSegments.get(segment.roomId);
    if (!list) {
      list = [];
      this.roomSegments.set(segment.roomId, list);
    }
    list.push(segment);
    if (list.length > 500) {
      list.shift();
    }
    return true;
  }

  getSegments(roomId: string): readonly TranscriptSegment[] {
    return this.roomSegments.get(roomId) ?? [];
  }

  clearSegments(roomId: string): void {
    this.roomSegments.delete(roomId);
  }
}

export const globalTranscriptStore = new TranscriptStore();
