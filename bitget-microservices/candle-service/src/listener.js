import WebSocket from "ws";
import EventEmitter from "events";
import ReconciliationLayer from "./reconciliationLayer.js";

class CandleStickWsClient extends EventEmitter {
  constructor(config) {
    super();
    this.url = config.url;
    this.instType = config.instType;
    this.clientId = config.clientId;
    this.totalCoinsSubscribed = 0;

    this.ws = null;
    this.lastPong = Date.now();
    this.pingInterval = 10_000;
    this.pongTimeout = 5_000;
    this.reconnectDelay = 5_000;
    this.msgLimit = 10;

    this.running = false;
    this.connecting = false;
    this.reconnectTimer = null;
    this.pingTimer = null;
    this.msgTimestamps = [];
    this.subscriptions = new Set(); // store (symbol, interval)
    this.reconciliationObjs = new Map();
  }

  async connect() {
    if (this.running) {
      console.log("Client already running.");
      return;
    }

    this.running = true;
    this.connecting = true;
    this._makeConnection();
  }

  async disconnect() {
    if (!this.running) {
      console.log("Client already stopped.");
      return;
    }
    this.running = false;

    console.log("Stopping client...");

    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this._closeWebsocket();

    this.emit("stopped");
    console.log("Client stopped cleanly.");
  }

  _makeConnection() {
    console.log(`Connecting to ${this.url} ...`);

    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.ws = new WebSocket(this.url);

    this.ws.on("open", () => {
      console.log("Websocket connected.");
      this.connecting = false;
      this.emit("connection");
      this.lastPong = Date.now();

      console.log("\nResubscribing to previous subscriptions...\n");

      this._resubscribeToAll();

      //   setTimeout(() => {
      //     console.log("resubscribing...");
      //     this.subscribe("BTCUSDT", "1s");
      //   }, 6000);

      this.pingTimer = setInterval(() => this._sendPing(), this.pingInterval);
    });

    this.ws.on("message", (raw) => {
      try {
        const messageStr = raw.toString("utf-8");

        if (messageStr === "pong") {
          this.lastPong = Date.now();
          //   console.log("Pong received.");
          return;
        }

        const msg = JSON.parse(messageStr);
        if (msg.action === "update" || msg.action === "snapshot") {
          const symbol = msg.arg.instId;
          const reconciliationLayer = this._getReconciliationLayer(symbol);
          reconciliationLayer.handleCandleData?.(msg);
        }
      } catch (err) {
        console.error("Message parse error:", err);
      }
    });

    this.ws.on("close", () => {
      console.log("Websocket closed.");
      this._closeWebsocketAndScheduleReconnect();
    });

    this.ws.on("error", (err) => {
      console.error("WebSocket error:", err.message);
      this._closeWebsocketAndScheduleReconnect();
    });
  }

  _scheduleReconnect() {
    console.log(`Reconnecting in ${this.reconnectDelay / 1000}s...`);
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectTimer = setTimeout(() => this._makeConnection(), this.reconnectDelay);
  }

  async _sendPing() {
    // console.log("Setting ping...");
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const pingMsg = "ping";

    await this._rateLimitedSend(pingMsg);

    // console.log("Ping sent.");

    if (Date.now() - this.lastPong > this.pingInterval + this.pongTimeout) {
      console.log("Pong timeout. Triggering reconnect...");
      this._closeWebsocketAndScheduleReconnect();
    }
  }

  async subscribe(symbol, interval) {
    // this method set reconnectionLayer for the given symbol if already not set
    this._setReconciliationLayer(symbol, interval);
    const subMsg = {
      op: "subscribe",
      args: [
        {
          instType: this.instType,
          channel: `candle${interval}`,
          instId: symbol,
        },
      ],
    };

    const jsonMess = JSON.stringify(subMsg);
    await this._rateLimitedSend(jsonMess);
    this._addAsubscription(symbol, interval);
  }

  async unsubscribe(symbol, interval) {
    const unsubMsg = {
      op: "unsubscribe",
      args: [
        {
          instType: this.instType,
          channel: `candle${interval}`,
          instId: symbol,
        },
      ],
    };
    const jsonMess = JSON.stringify(unsubMsg);
    await this._rateLimitedSend(jsonMess);
    this._removeAsubscription(symbol, interval);
  }

  async _rateLimitedSend(message) {
    await this._waitForConnection();

    const now = Date.now();
    this.msgTimestamps = this.msgTimestamps.filter((t) => now - t < 1000);

    if (this.msgTimestamps.length >= this.msgLimit) {
      const delay = 1000 - (now - this.msgTimestamps[0]);
      console.log(`Rate limit hit, delaying ${(delay / 1000).toFixed(2)}s`);
      await new Promise((r) => setTimeout(r, delay));
    }

    this.msgTimestamps.push(Date.now());
    this.ws.send?.(message);
  }

  _closeWebsocket() {
    if (this.ws) {
      const ws = this.ws;
      this.ws = null;

      try {
        ws.close?.();
        setTimeout(() => {
          if (ws && ws.readyState !== WebSocket.CLOSED) {
            console.log("Websocket didn't close gracefully, terminating...");
            ws.terminate?.();
          }
        }, 1500);
      } catch {
        console.log("Error closing the websocket.");
        ws.terminate?.();
      } finally {
        this.emit("closed");
        this.connecting = false;
      }
    }
  }

  _closeWebsocketAndScheduleReconnect() {
    if (!this.running) return;
    this._closeWebsocket();
    this._scheduleReconnect();
  }

  _resubscribeToAll() {
    const subscriptions = this._getSubscriptions();
    for (const { symbol, interval } of subscriptions) {
      console.log(`Resubscribing to ${symbol} (${interval})`);
      this.subscribe(symbol, interval);
    }
  }

  _addAsubscription(symbol, interval) {
    const key = `${symbol}|${interval}`;
    if (this.subscriptions.has(key)) return;
    this.subscriptions.add(key);
    this.totalCoinsSubscribed++;
    console.log(`Subscribed: ${symbol} (${interval})`);
  }

  _hasSubscription(symbol, interval) {
    const key = `${symbol}|${interval}`;
    return this.subscriptions.has(key);
  }

  _removeAsubscription(symbol, interval) {
    const key = `${symbol}|${interval}`;
    if (this.subscriptions.has(key)) {
      this.subscriptions.delete(key);
      this.totalCoinsSubscribed--;
      console.log(`Unsubscribed: ${symbol} (${interval})`);
    }
  }

  _getSubscriptions() {
    const result = [];
    for (const key of this.subscriptions) {
      const [symbol, interval] = key.split("|");
      result.push({ symbol, interval });
    }
    return result;
  }

  async _waitForConnection() {
    while (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  _setReconciliationLayer(symbol, interval) {
    const alreadyHas = this.reconciliationObjs.get(symbol);
    if (alreadyHas) return;
    const reconciliationLayer = new ReconciliationLayer({ symbol, interval });
    this.reconciliationObjs.set(symbol, reconciliationLayer);
  }

  _getReconciliationLayer(symbol) {
    return this.reconciliationObjs.get(symbol);
  }

  _deleteReconciliationLayer(symbol) {
    this.reconciliationObjs.delete(symbol);
  }
}

export default CandleStickWsClient;
