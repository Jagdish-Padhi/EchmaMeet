/**
 * WebSocket wrapper with exponential backoff + full jitter, explicit lifecycle and a hook that
 * fires after every successful (re)connect so callers can resynchronise (e.g. request a canvas
 * replay from the last sequence they saw).
 */
export interface SocketLike {
  readyState: number;
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: { code: number }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  send(data: string): void;
  close(code?: number): void;
}

export interface ReconnectingSocketOptions {
  readonly createSocket: () => SocketLike;
  readonly onMessage: (data: unknown) => void;
  readonly onOpen?: (isReconnect: boolean) => void;
  readonly onStatus?: (
    status: 'connecting' | 'open' | 'reconnecting' | 'closed' | 'rejected',
  ) => void;
  readonly baseDelayMs?: number;
  readonly maxDelayMs?: number;
  readonly random?: () => number;
  readonly setTimer?: (fn: () => void, ms: number) => unknown;
  readonly clearTimer?: (handle: unknown) => void;
}

const OPEN = 1;
/** Close codes that mean "do not retry": policy violation / auth / forbidden. */
const FATAL_CODES = new Set([1008, 4001, 4003]);

export class ReconnectingSocket {
  private socket: SocketLike | null = null;
  private attempt = 0;
  private everOpened = false;
  private stopped = false;
  private timer: unknown = null;

  constructor(private readonly options: ReconnectingSocketOptions) {}

  start(): void {
    this.stopped = false;
    this.connect();
  }

  send(message: unknown): boolean {
    if (this.socket?.readyState !== OPEN) return false;
    this.socket.send(typeof message === 'string' ? message : JSON.stringify(message));
    return true;
  }

  get isOpen(): boolean {
    return this.socket?.readyState === OPEN;
  }

  stop(): void {
    this.stopped = true;
    if (this.timer !== null) {
      (this.options.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>)))(
        this.timer,
      );
      this.timer = null;
    }
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null;
      socket.close(1000);
    }
    this.options.onStatus?.('closed');
  }

  private connect(): void {
    this.options.onStatus?.(this.everOpened ? 'reconnecting' : 'connecting');
    const socket = this.options.createSocket();
    this.socket = socket;
    socket.onopen = () => {
      const reconnect = this.everOpened;
      this.everOpened = true;
      this.attempt = 0;
      this.options.onStatus?.('open');
      this.options.onOpen?.(reconnect);
    };
    socket.onmessage = (event) => {
      this.options.onMessage(event.data);
    };
    socket.onerror = () => {
      // The close event that follows drives the retry; nothing to do here.
    };
    socket.onclose = (event) => {
      if (this.stopped || this.socket !== socket) return;
      this.socket = null;
      if (FATAL_CODES.has(event.code) || (!this.everOpened && this.attempt >= 6)) {
        this.options.onStatus?.('rejected');
        return;
      }
      const base = this.options.baseDelayMs ?? 500;
      const max = this.options.maxDelayMs ?? 15_000;
      const ceiling = Math.min(max, base * 2 ** this.attempt);
      const delay = Math.round((this.options.random ?? Math.random)() * ceiling);
      this.attempt += 1;
      this.options.onStatus?.('reconnecting');
      this.timer = (this.options.setTimer ?? ((fn, ms) => setTimeout(fn, ms)))(() => {
        this.timer = null;
        if (!this.stopped) this.connect();
      }, delay);
    };
  }
}
