import type { Server } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { voiceClientMessageSchema, type VoiceServerMessage } from '@chaosboard/contracts';
import type { VoiceService } from '../application/voice-service';

export function attachVoiceWebSocketBridge(
  httpServer: Server,
  voiceService: VoiceService,
): WebSocketServer {
  const wss = new WebSocketServer({
    noServer: true,
  });

  httpServer.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
    if (url.pathname === '/ws/voice') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws: WebSocket) => {
    let audioChunks: Buffer[] = [];
    let audioDurationMs = 0;

    const sendMessage = (msg: VoiceServerMessage) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(msg));
      }
    };

    ws.on('message', (data, isBinary) => {
      void (async () => {
        try {
          if (isBinary) {
            audioChunks.push(Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer));
            return;
          }

          let text: string;
          if (Buffer.isBuffer(data)) {
            text = data.toString('utf8');
          } else if (Array.isArray(data)) {
            text = Buffer.concat(data).toString('utf8');
          } else {
            text = Buffer.from(data).toString('utf8');
          }
          const parsed: unknown = JSON.parse(text);
          const message = voiceClientMessageSchema.parse(parsed);

          if (message.type === 'audio_chunk') {
            audioChunks.push(Buffer.from(message.data, 'base64'));
          } else if (message.type === 'end_utterance') {
            audioDurationMs = message.audioDurationMs;
            const fullAudio = Buffer.concat(audioChunks);
            audioChunks = [];

            sendMessage({
              type: 'transcript_partial',
              text: 'Processing speech...',
            });

            const result = await voiceService.parseCommand({
              audioBase64: fullAudio.toString('base64'),
              audioDurationMs,
              nodes: [],
              edges: [],
            });

            sendMessage({
              type: 'transcript_final',
              text: result.transcript,
              latencyMs: result.timings.transcriptMs,
            });

            sendMessage({
              type: 'intent_parsed',
              result,
            });
          } else {
            sendMessage({
              type: 'transcript_partial',
              text: message.transcript,
            });

            const result = await voiceService.parseCommand({
              transcript: message.transcript,
              audioDurationMs: message.audioDurationMs,
              nodes: [],
              edges: [],
            });

            sendMessage({
              type: 'transcript_final',
              text: message.transcript,
              latencyMs: result.timings.transcriptMs,
            });

            sendMessage({
              type: 'intent_parsed',
              result,
            });
          }
        } catch (err: unknown) {
          sendMessage({
            type: 'error',
            message: err instanceof Error ? err.message : 'Invalid websocket message',
          });
        }
      })();
    });
  });

  return wss;
}
