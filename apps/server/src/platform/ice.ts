import { createHmac } from 'node:crypto';

export interface IceSettings {
  readonly stunUrls: readonly string[];
  readonly turnUrls: readonly string[];
  readonly turnSharedSecret: string;
  readonly turnTtlSeconds: number;
}

export interface IceServer {
  readonly urls: readonly string[];
  readonly username?: string;
  readonly credential?: string;
}

export interface IceConfiguration {
  readonly iceServers: readonly IceServer[];
  readonly turnConfigured: boolean;
  readonly expiresAt: number | null;
}

/**
 * ICE configuration for one participant. TURN credentials follow the coturn REST-API scheme
 * (`use-auth-secret`): the username is `<expiry>:<userId>` and the credential is
 * base64(HMAC-SHA1(sharedSecret, username)). They are short-lived and per-user, so a leaked
 * credential cannot be reused to relay traffic indefinitely.
 */
export function buildIceConfiguration(
  settings: IceSettings,
  userId: string,
  nowMs: number = Date.now(),
): IceConfiguration {
  const servers: IceServer[] = [];
  if (settings.stunUrls.length > 0) {
    servers.push({ urls: settings.stunUrls });
  }
  const turnConfigured = settings.turnUrls.length > 0 && settings.turnSharedSecret.length > 0;
  let expiresAt: number | null = null;
  if (turnConfigured) {
    expiresAt = Math.floor(nowMs / 1000) + settings.turnTtlSeconds;
    const username = `${String(expiresAt)}:${userId}`;
    const credential = createHmac('sha1', settings.turnSharedSecret)
      .update(username)
      .digest('base64');
    servers.push({ urls: settings.turnUrls, username, credential });
  }
  return { iceServers: servers, turnConfigured, expiresAt };
}
