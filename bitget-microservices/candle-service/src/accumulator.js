const dbOperations = require("./db.operations");

class Accumulator {
  constructor() {
    this.pairs = new Map();
  }

  registerPair(pair) {
    if (this.pairs.has(pair)) return;
    this.pairs.set(pair, []);
  }

  unregisterPair(pair) {
    if (!this.pairs.has(pair)) return;
    this.pairs.delete(pair);
  }

  handleUpdate(pair, data) {
    if (data.length > 2) {
      console.log("data.length > 2");
      process.exit();
    }
    // [c1, c2]
    if (data.length === 2) {
      const { candle1, candle2 } = this._get2candleFromArray(data);
      const candles = this.pairs.get(pair);
      if (candles.length === 0) {
        this.pairs.set(pair, [candle1, candle2]);
        return;
      } else if (candles.length === 1) {
        this.pairs.set(pair, [candle1, candle2]);
        return;
      }

      this.pairs.set(pair, [candles[0], candle1]);
      this._handleCandleClose(pair, candle2);
    } else if (data.length === 1) {
      const { candle1 } = this._get1candleFromArray(data);
      const candles = this.pairs.get(pair);

      if (candles.length === 0) {
        this.pairs.set(pair, [candle1]);
        return;
      } else if (candles.length === 1) {
        const currentCandle = candles[0];
        const isClose = candle1.startTime !== currentCandle.startTime;
        if (!isClose) {
          this.pairs.set(pair, [candle1]);
          return;
        } else {
          this.pairs.set(pair, [candles[0], candle1]);
          return;
        }
      }
      const isClose = candle1.startTime !== candles[1].startTime;
      if (!isClose) {
        this.pairs.set(pair, [candles[0], candle1]);
      } else {
        this._handleCandleClose(pair, candle1);
      }
    }
  }

  _handleCandleClose(pair, newCandle) {
    const candles = this.pairs.get(pair);

    if (candles[0].startTime + 1000 * 60 !== candles[1].startTime) {
      console.log("inconsistant candles");
      console.log(candles[0], candles[1]);
      process.exit();
    }

    if ((candles[0].startTime / (1000 * 60)) % 2 === 0) {
      //two minute candle close
      const twoMinuteCandle = this._getMergeCande(candles[0], candles[1]);
      //   console.log({ ...twoMinuteCandle, startTime: new Date(twoMinuteCandle.startTime).toISOString() });

      this._saveDB(pair, twoMinuteCandle);
    }
    this.pairs.set(pair, [candles[1], newCandle]);
    return;
  }

  async _saveDB(pair, candle) {
    // [ timestamp, open, max price, min price, close, volume ]
    const insetingArray = [[candle.startTime, candle.open, candle.high, candle.low, candle.close, candle.volume]];
    await new Promise((res) => setTimeout(res, 300));
    await dbOperations.insertCandles(pair, insetingArray);
    console.log(`Inserted : ${new Date(candle.startTime).toISOString()} - ${pair}`);
  }

  _get2candleFromArray(data) {
    const t1 = parseFloat(data[0][0]);
    const t2 = parseFloat(data[1][0]);
    if (t1 === t2) {
      console.log("t1 === t2");
      process.exit();
    }
    return t1 < t2
      ? { candle1: this._getCandleFromData(data[0]), candle2: this._getCandleFromData(data[1]) }
      : { candle1: this._getCandleFromData(data[1]), candle2: this._getCandleFromData(data[0]) };
  }

  _get1candleFromArray(data) {
    return { candle1: this._getCandleFromData(data[0]) };
  }

  _printCandle() {
    console.log(this.currentCandle);
    // from this function we will send the candle stick data to trade engine
  }

  _getMergeCande(candle1, candle2) {
    const merged = {
      startTime: candle1.startTime,
      open: candle1.open,
      high: Math.max(candle1.high, candle2.high),
      low: Math.min(candle1.low, candle2.low),
      close: candle2.close,
      volume: candle1.volume + candle2.volume,
    };
    return merged;
  }

  _getCandleFromData(candleData) {
    const candle = {
      startTime: parseInt(candleData[0]),
      open: parseFloat(candleData[1]),
      high: parseFloat(candleData[2]),
      low: parseFloat(candleData[3]),
      close: parseFloat(candleData[4]),
      volume: parseFloat(candleData[5]),
    };

    return candle;
  }
}

module.exports = Accumulator;
