import type { Server } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import {
  voiceClientMessageSchema,
  type VoiceClientMessage,
  type VoiceServerMessage,
} from '@chaosboard/contracts';
import { GnaniError, RealtimeSttSession, type RealtimeSttConfig } from '../../gnani';
import { buildKeyterms, type VoiceService } from '../application/voice-service';

export interface VoiceBridgeOptions {
  readonly authenticate?: (token: string) => boolean | Promise<boolean>;
  /** Gnani realtime configuration. Without it the bridge still accepts typed `parse_intent`. */
  readonly realtime?: RealtimeSttConfig | undefined;
}

const UNAUTHORIZED =
  'HTTP/1.1 401 Unauthorized\r\nContent-Type: text/plain\r\nConnection: close\r\n\r\nUnauthorized\n';

export function attachVoiceWebSocketBridge(
  httpServer: Server,
  voiceService: VoiceService,
  options?: VoiceBridgeOptions,
): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    void (async () => {
      const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
      if (url.pathname !== '/ws/voice') return;

      if (options?.authenticate) {
        const header = request.headers.authorization;
        const token =
          url.searchParams.get('token') ??
          (header?.startsWith('Bearer ') ? header.slice(7).trim() : null);
        let ok: boolean;
        try {
          ok = token ? await options.authenticate(token) : false;
        } catch {
          ok = false;
        }
        if (!ok) {
          socket.write(UNAUTHORIZED);
          socket.destroy();
          return;
        }
      }
      wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request));
    })();
  });

  wss.on('connection', (ws: WebSocket) => {
    const send = (msg: VoiceServerMessage): void => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
    };

    let session: RealtimeSttSession | undefined;
    let context: Extract<VoiceClientMessage, { type: 'start' }> | undefined;
    let utteranceStartedAt = performance.now();
    // Segments are handled strictly in arrival order so replies never interleave.
    let chain: Promise<void> = Promise.resolve();

    const handleFinalText = (
      text: string,
      sttLatencyMs: number,
      language: string | undefined,
      captureMs: number,
    ): void => {
      chain = chain
        .then(async () => {
          send({
            type: 'transcript_final',
            text,
            latencyMs: sttLatencyMs,
            ...(language ? { language } : {}),
          });
          const result = await voiceService.parseCommand({
            transcript: text,
            audioDurationMs: captureMs,
            language,
            nodes: context?.nodes ?? [],
            edges: context?.edges ?? [],
          });
          const withTimings = {
            ...result,
            timings: { ...result.timings, transcriptMs: sttLatencyMs },
          };
          send({ type: 'intent_parsed', result: withTimings });
          let ttsMs: number | undefined;
          if (context?.speakReplies !== false) {
            const speech = await voiceService.speak(withTimings);
            ttsMs = speech?.latencyMs;
            if (speech) {
              send({
                type: 'speech_reply',
                text: withTimings.spokenReply ?? '',
                language: withTimings.language ?? 'en-IN',
                voice: speech.voice,
                contentType: speech.contentType,
                audioBase64: Buffer.from(speech.audio).toString('base64'),
                latencyMs: speech.latencyMs,
              });
            }
          }
          await voiceService.log(withTimings, { source: 'websocket', ttsMs });
        })
        .catch((err: unknown) => {
          send({
            type: 'error',
            message: err instanceof Error ? err.message : 'Voice pipeline failed',
          });
        });
    };

    const startSession = async (
      start: Extract<VoiceClientMessage, { type: 'start' }>,
    ): Promise<void> => {
      session?.close();
      context = start;
      if (!options?.realtime) {
        throw new GnaniError(
          'not_configured',
          'Gnani streaming is not configured (GNANI_API_KEY).',
        );
      }
      const created = new RealtimeSttSession(
        options.realtime,
        {
          language: start.language,
          sampleRate: start.sampleRate,
          keyterms: buildKeyterms(start.nodes, start.edges),
        },
        {
          onReady: () => undefined,
          onProcessing: () => send({ type: 'transcript_partial', text: '…' }),
          onTranscript: (e) =>
            handleFinalText(
              e.text,
              e.latencyMs,
              e.language,
              Math.round(performance.now() - utteranceStartedAt),
            ),
          onError: (error) => send({ type: 'error', message: error.message }),
          onClose: () => undefined,
        },
      );
      await created.open();
      session = created;
      send({ type: 'ready', sttModel: options.realtime.model, language: start.language });
    };

    ws.on('message', (data, isBinary) => {
      void (async () => {
        try {
          if (isBinary) {
            session?.sendPcm(Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer));
            return;
          }
          const text = Buffer.isBuffer(data)
            ? data.toString('utf8')
            : Buffer.from(data as ArrayBuffer).toString('utf8');
          const message = voiceClientMessageSchema.parse(JSON.parse(text));
          switch (message.type) {
            case 'start':
              utteranceStartedAt = performance.now();
              await startSession(message);
              break;
            case 'audio_chunk':
              session?.sendPcm(Buffer.from(message.data, 'base64'));
              break;
            case 'end_utterance':
              session?.endUtterance();
              break;
            case 'parse_intent': {
              send({ type: 'transcript_partial', text: message.transcript });
              handleFinalText(message.transcript, 0, context?.language, message.audioDurationMs);
              break;
            }
          }
        } catch (err: unknown) {
          send({
            type: 'error',
            message: err instanceof Error ? err.message : 'Invalid websocket message',
          });
        }
      })();
    });

    ws.on('close', () => session?.close());
  });

  return wss;
}
