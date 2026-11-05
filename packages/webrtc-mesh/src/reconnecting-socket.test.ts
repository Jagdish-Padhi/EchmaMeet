import { describe, expect, it } from 'vitest';
import { ReconnectingSocket, type SocketLike } from './reconnecting-socket';

class FakeSocket implements SocketLike {
  readyState = 0;
  onopen: SocketLike['onopen'] = null;
  onmessage: SocketLike['onmessage'] = null;
  onclose: SocketLike['onclose'] = null;
  onerror: SocketLike['onerror'] = null;
  sent: string[] = [];
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
  }
  open() {
    this.readyState = 1;
    this.onopen?.({});
  }
  drop(code = 1006) {
    this.readyState = 3;
    this.onclose?.({ code });
  }
}

function harness(random = () => 1) {
  const sockets: FakeSocket[] = [];
  const timers: { fn: () => void; ms: number }[] = [];
  const statuses: string[] = [];
  const opens: boolean[] = [];
  const socket = new ReconnectingSocket({
    createSocket: () => {
      const s = new FakeSocket();
      sockets.push(s);
      return s;
    },
    onMessage: () => undefined,
    onOpen: (re) => opens.push(re),
    onStatus: (s) => statuses.push(s),
    baseDelayMs: 100,
    maxDelayMs: 1000,
    random,
    setTimer: (fn, ms) => {
      timers.push({ fn, ms });
      return timers.length;
    },
    clearTimer: () => undefined,
  });
  return { socket, sockets, timers, statuses, opens };
}

describe('ReconnectingSocket', () => {
  it('reconnects with exponential backoff and flags reconnects so callers can resync', () => {
    const h = harness();
    h.socket.start();
    h.sockets[0]?.open();
    h.sockets[0]?.drop();
    expect(h.timers[0]?.ms).toBe(100);
    h.timers[0]?.fn();
    h.sockets[1]?.drop(); // fails before opening
    expect(h.timers[1]?.ms).toBe(200);
    h.timers[1]?.fn();
    h.sockets[2]?.open();
    expect(h.opens).toEqual([false, true]);
    // A successful open resets the backoff.
    h.sockets[2]?.drop();
    expect(h.timers[2]?.ms).toBe(100);
  });

  it('caps the delay and applies jitter', () => {
    const h = harness(() => 0.5);
    h.socket.start();
    h.sockets[0]?.open();
    for (let i = 0; i < 8; i += 1) {
      h.sockets.at(-1)?.drop();
      h.timers.at(-1)?.fn();
    }
    expect(Math.max(...h.timers.map((t) => t.ms))).toBeLessThanOrEqual(500);
  });

  it('does not retry after a policy-violation or auth close', () => {
    const h = harness();
    h.socket.start();
    h.sockets[0]?.open();
    h.sockets[0]?.drop(1008);
    expect(h.timers).toHaveLength(0);
    expect(h.statuses.at(-1)).toBe('rejected');
  });

  it('stop() prevents any further reconnect and ignores late events', () => {
    const h = harness();
    h.socket.start();
    h.sockets[0]?.open();
    h.socket.stop();
    h.sockets[0]?.drop();
    expect(h.timers).toHaveLength(0);
    expect(h.socket.send({ a: 1 })).toBe(false);
  });
});
