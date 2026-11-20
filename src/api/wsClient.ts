export type WsConnectionStatus = 'connecting' | 'connected' | 'reconnecting';

export interface WsEnvelope<T = unknown> {
  event: string;
  payload: T;
}

type EventListener = (envelope: WsEnvelope) => void;
type StatusListener = (status: WsConnectionStatus) => void;

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const part = document.cookie.split(';').find((c) => c.trim().startsWith(`${name}=`));
  return part ? decodeURIComponent(part.trim().slice(name.length + 1)) : null;
}

class SharedWsClient {
  private ws: WebSocket | null = null;
  private status: WsConnectionStatus = 'connecting';
  private eventListeners = new Set<EventListener>();
  private statusListeners = new Set<StatusListener>();
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private delayMs = 1000;
  private started = false;

  private setStatus(next: WsConnectionStatus) {
    this.status = next;
    for (const cb of this.statusListeners) {
      cb(next);
    }
  }

  public start() {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;
    this.connect();
  }

  private connect() {
    if (typeof window === 'undefined') return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    if (!readCookie('camio_signed_in')) {
      // Le serveur exige une session : éviter un handshake 401 (bruit console).
      if (!this.retryTimer) {
        this.setStatus('reconnecting');
        this.retryTimer = setTimeout(() => {
          this.retryTimer = null;
          this.connect();
        }, 5000);
      }
      return;
    }
    // Le cookie httpOnly camio_sid est envoyé automatiquement au handshake :
    // c'est lui que verifyClient vérifie côté serveur (pas de jeton dans l'URL).
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
    this.ws = ws;

    ws.onopen = () => {
      this.delayMs = 1000;
      this.setStatus('connected');
    };

    ws.onmessage = (evt) => {
      try {
        const parsed = JSON.parse(evt.data) as WsEnvelope;
        if (!parsed?.event) return;
        for (const cb of this.eventListeners) {
          cb(parsed);
        }
      } catch {
        // Ignore malformed WebSocket frames
      }
    };

    ws.onclose = () => {
      this.ws = null;
      this.setStatus('reconnecting');
      if (this.retryTimer) clearTimeout(this.retryTimer);
      this.retryTimer = setTimeout(() => {
        this.connect();
      }, this.delayMs);
      this.delayMs = Math.min(15000, this.delayMs * 2);
    };

    ws.onerror = () => {
      // onclose will handle exponential backoff reconnect
    };
  }

  public getStatus(): WsConnectionStatus {
    return this.status;
  }

  public subscribeEvents(listener: EventListener): () => void {
    this.start();
    this.eventListeners.add(listener);
    return () => {
      this.eventListeners.delete(listener);
    };
  }

  public subscribeStatus(listener: StatusListener): () => void {
    this.start();
    this.statusListeners.add(listener);
    listener(this.status);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  public send(event: string, payload: unknown): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    this.ws.send(JSON.stringify({ event, payload }));
    return true;
  }
}

export const wsClient = new SharedWsClient();
