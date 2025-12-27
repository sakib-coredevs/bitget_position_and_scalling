const CandleStickWsClient = require("./listener.js");
const EventEmitter = require("events");

class CandleStickClientManager extends EventEmitter {
  constructor() {
    super();
    this.url = "wss://ws.bitget.com/v2/ws/public";
    this.instType = "USDT-FUTURES";
    this.totalCoinsSubscribed = 0;
    this.maxCoinsPerListner = 5;
    this.listeners = []; //{ listener, subscriptions }
    this.defaultInverval = "1m";
    this.subscriptions = new Set();
  }

  async start() {
    if (this.listeners.length > 0) {
      console.log("Manager already started.");
      return;
    }
    await this._createNewListener();
    // this.report();
    console.log("CandleStickClientManager started.");
  }

  report() {
    setInterval(() => {
      console.log(`Here are ${this.listeners.length} ws clients total.`);
      for (const { listener, subscriptions } of this.listeners) {
        console.log(`Listener id : ${listener.clientId}; Subscriptions : ${subscriptions.join(",")}`);
      }
    }, 2000);
  }

  async subscribe(symbol, interval = this.defaultInverval) {
    const key = `${symbol}|${interval}`;
    if (this.subscriptions.has(key)) {
      console.log(`Already subscribed to ${symbol} ${interval}`);
      return;
    }

    const leastLoaded = this._getLeastLoadedListner();

    if (leastLoaded && leastLoaded.totalCoinsSubscribed < this.maxCoinsPerListner) {
      await leastLoaded.subscribe(symbol, interval);
      this._addASubscription(leastLoaded, symbol, interval);
    } else {
      const newListener = await this._createNewListener();
      await newListener.subscribe(symbol, interval);
      this._addASubscription(newListener, symbol, interval);
    }
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
    const key = `${symbol}|${interval}`;
    for (const { listener, subscriptions } of this.listeners) {
      if (subscriptions.includes(key)) {
        return listener;
      }
    }
    return null;
  }

  _getLeastLoadedListner() {
    if (this.listeners.length === 0) {
      return null;
    }

    let leastLoaded = this.listeners[0];
    for (const listenerObj of this.listeners) {
      if (listenerObj.listener.totalCoinsSubscribed < leastLoaded.listener.totalCoinsSubscribed) {
        leastLoaded = listenerObj;
      }
    }
    return leastLoaded.listener;
  }

  async _createNewListener() {
    const clientId = this.listeners.length + 1;
    const listener = new CandleStickWsClient({
      url: this.url,
      instType: this.instType,
      clientId,
    });

    await listener.connect();
    this._addAListener(listener);
    return listener;
  }

  _addASubscription(listnr, symbol, interval) {
    const key = `${symbol}|${interval}`;
    if (this.subscriptions.has(key)) return;

    this.subscriptions.add(key);
    this.totalCoinsSubscribed++;

    for (const { listener, subscriptions } of this.listeners) {
      if (listener === listnr) {
        subscriptions.push(key);
        break;
      }
    }
  }

  _removeASubscription(symbol, interval) {
    const key = `${symbol}|${interval}`;
    if (!this.subscriptions.has(key)) return;

    this.subscriptions.delete(key);
    this.totalCoinsSubscribed--;

    for (const { subscriptions } of this.listeners) {
      const index = subscriptions.indexOf(key);
      if (index > -1) {
        subscriptions.splice(index, 1);
        break;
      }
    }
  }

  _addAListener(listener) {
    this.listeners.push({ listener, subscriptions: [] });
  }

  _removeAListener(listenerToRemove) {
    listenerToRemove.disconnect();
    this.listeners = this.listeners.filter(({ listener }) => listener !== listenerToRemove);
  }
}

module.exports = CandleStickClientManager;
