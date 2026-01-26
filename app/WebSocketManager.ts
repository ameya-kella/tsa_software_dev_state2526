class WebSocketManager {
  private ws: WebSocket | null = null;
  private readonly url: string = "ws://192.168.1.175:8000/ws";


  constructor() {
    this.connect();
  }

  private connect() {
    if (this.ws) return;  // prevent reconnecting if already connected
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log("WebSocket connected");
    };

    this.ws.onclose = () => {
      console.log("WebSocket disconnected");
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket error", error);
    };
  }

  public send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn("WebSocket not open. Data not sent.");
    }
  }

  public onMessage(callback: (message: any) => void) {
    if (this.ws) {
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          callback(data);
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };
    }
  }

  public close() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  public getInstance() {
    return this.ws;
  }
}

export const wsManager = new WebSocketManager();
