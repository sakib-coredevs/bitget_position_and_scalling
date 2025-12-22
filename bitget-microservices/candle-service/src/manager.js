import CandleStickWsClient from "./listener.js";
import EventEmitter from "events";
class CandleStickClientManager extends EventEmitter {
  constructor() {
    super();
    this.url = "wss://ws.bitget.com/v2/ws/public";
    this.instType = "USDT-FUTURES";
    this.totalCoinsSubscribed = 0;
    this.maxCoinsPerListner = 30;
    this.listeners = [];
    this.defaultInverval = "1m";
    this.subscriptions = new Set(); // (symbol, interval);
  }

  async start() {
    if (this.listeners.length > 0) {
      console.log("Manager already started.");
      return;
    }
    await this._createNewListener();
    console.log("CandleStickClientManager started.");
  }

  async subscribe(symbol, interval = this.defaultInverval) {
    if (this.subscriptions.has([symbol, interval])) {
      console.log(`Already subscribed to ${symbol} ${interval}`);
      return;
    }

    const leastLoaded = this._getLeastLoadedListner();

    if (leastLoaded.totalCoinsSubscribed < this.maxCoinsPerListner) {
      await leastLoaded.subscribe(symbol, interval);
    } else {
      const newListener = await this._createNewListener();
      await newListener.subscribe(symbol, interval);
    }

    this._addASubscription(symbol, interval);
  }

  async unsubscribe(symbol, interval = this.defaultInverval) {
    const listener = this._getListenerBySymbolAndInterval(symbol, interval);

    if (!listener) {
      console.log(`No listener found for ${symbol} with interval ${interval} to unsubscribe.`);
      return;
    }

    await listener.unsubscribe(symbol, interval);

    this._removeASubscription(symbol, interval);

    if (listener.totalCoinsSubscribed === 0) {
      this._removeAListener(listener);
    }
  }

  _getListenerBySymbolAndInterval(symbol, interval) {
    for (const listener of this.listeners) {
      if (listener.subscriptions.has([symbol, interval])) {
        return listener;
      }
    }
    return null;
  }

  _getLeastLoadedListner() {
    let leastLoaded = this.listeners[0];
    for (const listener of this.listeners) {
      if (listener.totalCoinsSubscribed < leastLoaded.totalCoinsSubscribed) {
        leastLoaded = listener;
      }
    }
    return leastLoaded;
  }

  async _createNewListener() {
    const listener = new CandleStickWsClient({
      url: this.url,
      instType: this.instType,
      clientId: this.listeners.length + 1,
    });

    await listener.connect();
    this._addAListener(listener);
    return listener;
  }

  _addASubscription(symbol, interval) {
    if (this.subscriptions.has([symbol, interval])) return;
    this.subscriptions.add([symbol, interval]);
    this.totalCoinsSubscribed++;
  }

  _removeASubscription(symbol, interval) {
    if (this.subscriptions.has([symbol, interval])) {
      this.subscriptions.delete([symbol, interval]);
      this.totalCoinsSubscribed--;
    }
  }

  _addAListener(listener) {
    this.listeners.push(listener);
  }

  _removeAListener(listener) {
    listener.disconnect();
    this.listeners = this.listeners.filter((l) => l !== listener);
  }
}

export default CandleStickClientManager;
