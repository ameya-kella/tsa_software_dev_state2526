export type ASLBackendResponse = {
  current_sign: string;
  confidence: number;
  top5: [string, number][];
  recognized_words: string[];
  generated_sentence: string;
};

export class ASLWebSocket {
  private ws: WebSocket | null = null;
  private callbacks: { [key: string]: (data: ASLBackendResponse) => void } = {};

  constructor(private url: string) {}

  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => console.log("WS connected to backend");
    this.ws.onmessage = (msg) => {
      const data: ASLBackendResponse = JSON.parse(msg.data);
      if (this.callbacks["message"]) this.callbacks["message"](data);
    };
    this.ws.onclose = () => console.log("WS closed");
    this.ws.onerror = (e) => console.log("WS error", e);
  }

  // send landmarks and optionally trigger sentence generation ----
  sendLandmarks(landmarks: number[][], generateSentence = false) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          landmarks,
          generate_sentence: generateSentence, // flag to backend
        })
      );
    }
  }

  onMessage(callback: (data: ASLBackendResponse) => void) {
    this.callbacks["message"] = callback;
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
  }
}
