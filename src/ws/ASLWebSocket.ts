export type ASLBackendResponse = {
  current_sign: string;
  confidence: number | null;
  top5: [string, number][] | null;
  recognized_words: string[];
  generated_sentence?: string;
};

type MessageHandler = (data: ASLBackendResponse) => void;


export class ASLWebSocket {
  private ws: WebSocket | null = null;
  private handlers = new Set<MessageHandler>();
  private reconnectTimer: any = null;
  private heartbeatTimer: any = null;
  private lastContext: { flow: "interpreter" | "conversation" } | null = null;

  constructor(
    private url: string,
    private heartbeatMs = 15000,
    private reconnectMs = 3000
  ) {}

  connect() {
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN ||
      this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }
    console.log("[ASL WS] connecting...");
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log("[ASL WS] connected");
      this.startHeartbeat();
      if (this.lastContext) {
        this.ws.send(JSON.stringify({ type: "context", ...this.lastContext }));
      }
    };

    this.ws.onmessage = (msg) => {
      const data: ASLBackendResponse = JSON.parse(msg.data);
      this.handlers.forEach((h) => h(data));
    };

    this.ws.onclose = () => {
      console.log("[ASL WS] closed");
      this.cleanup();
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  sendLandmarks(landmarks: number[][], generateSentence = false) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({ landmarks, generate_sentence: generateSentence })
      );
    }
  }
  sendImage(base64: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ image: base64 }));
    }
  }

  clearRecognizedWords() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "clear" }));
    }
  }

  subscribe(handler: MessageHandler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  disconnect() {
    this.cleanup();
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.ws?.close();
    this.ws = null;
  }


  private startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "ping" }));
      }
    }, this.heartbeatMs);
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectMs);
  }

  private cleanup() {
    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }
  
  sendContext(ctx: { flow: "interpreter" | "conversation" }) {
    this.lastContext = ctx;

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "context", ...ctx }));
    } else {
    }
  }
}
