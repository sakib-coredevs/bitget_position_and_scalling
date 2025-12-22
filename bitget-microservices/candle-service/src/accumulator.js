class Accumulator {
  constructor(config = { symbol: "", intervalInto: 2 }) {
    this.candles = [];
    this.symbol = config.symbol;
    this.intervalMSec = config.intervalInto * 1000 * 60;
    this.startChartCandleTimestamp = null;
    this.currentCandle = null;
  }

  handleCandleData(msg) {
    if (msg.type === "update") {
      this._handleUpdateCandle(msg.data);
    } else if (msg.type === "new") {
      this._handleNewCandle(msg.data);
    }
  }

  _handleNewCandle(candle) {
    if (!this.startChartCandleTimestamp) {
      this.startChartCandleTimestamp = parseInt(candle[0]);
      this.currentCandle = this._getCandleFromData(candle);
      return;
    }
    // check should create new interval candle
    const candleTimestamp = parseInt(candle[0]);
    const isNewIntervalCandle = (candleTimestamp - this.startChartCandleTimestamp) % this.intervalMSec === 0;

    if (isNewIntervalCandle) {
      this.currentCandle = this._getCandleFromData(candle);
    } else {
      this._joinCandle(candle);
    }
  }

  _handleUpdateCandle(candle) {
    this._joinCandle(candle);
  }

  _joinCandle(candle) {
    this.currentCandle.high = Math.max(this.currentCandle.high, parseInt(candle[2]));
    this.currentCandle.low = Math.min(this.currentCandle.low, parseInt(candle[3]));
    this.currentCandle.close = parseInt(candle[4]);
    this.currentCandle.volume = this.currentCandle.volume + parseInt(candle[5]);
    this.currentCandle.quoteVolume = this.currentCandle.quoteVolume + parseInt(candle[6]);
    this.currentCandle.usdtVolume = this.currentCandle.usdtVolume + parseInt(candle[7]);

    this._printCandle();
  }

  _printCandle() {
    console.log(this.currentCandle);
    // from this function we will send the candle stick data to trade engine
  }

  _getCandleFromData(candleData) {
    const candle = {
      startTime: parseInt(candleData[0]),
      open: parseFloat(candleData[1]),
      high: parseFloat(candleData[2]),
      low: parseFloat(candleData[3]),
      close: parseFloat(candleData[4]),
      volume: parseFloat(candleData[5]),
      quoteVolume: parseFloat(candleData[6]),
      usdtVolume: parseFloat(candleData[7]),
    };

    return candle;
  }
}

export default Accumulator;
