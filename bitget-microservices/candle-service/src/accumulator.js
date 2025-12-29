const logger = require("../logger");
const bitgetClient = require("./bitget.client");
const dbOperations = require("./db.operations");

class Accumulator {
  constructor() {
    this.pairs = new Map();
    this.bulkUpdateCandles = new Map();
    this.isInsertTimerScheduled = false;
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
    // if (data.length > 2) {
    //   console.log("data.length > 2");
    //   process.exit();
    // }
    // [c1, c2]
    if (pair === "SOLUSDT") return;
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

    // if (candles[0].startTime + 1000 * 60 !== candles[1].startTime) {
    //   console.log("inconsistant candles");
    //   console.log(candles[0], candles[1]);
    //   process.exit();
    // }

    if ((candles[0].startTime / (1000 * 60)) % 2 === 0) {
      //two minute candle close
      const twoMinuteCandle = this._getMergeCande(candles[0], candles[1], pair);
      //   console.log({ ...twoMinuteCandle, startTime: new Date(twoMinuteCandle.startTime).toISOString() });

      this._prepareForBulkInsert(twoMinuteCandle);
    }
    this.pairs.set(pair, [candles[1], newCandle]);
    return;
  }

  _prepareForBulkInsert(candle) {
    // [candle.startTime, candle.open, candle.high, candle.low, candle.close, candle.volume, candle.pair]
    // [ timestamp, open, max price, min price, close, volume, ?pair ]

    const pair = candle.pair;
    this.bulkUpdateCandles.set(pair, candle);

    if (!this.isInsertTimerScheduled) {
      this.isInsertTimerScheduled = true;
      setTimeout(async () => {
        const activatedPairs = [...this.pairs.keys()];
        const bulkUpdatePairs = [...this.bulkUpdateCandles.keys()];
        const currentCandles = [...this.bulkUpdateCandles.values()];
        const missedCandlePairs = [];

        for (const actvPair of activatedPairs) {
          if (!bulkUpdatePairs.includes(actvPair)) {
            missedCandlePairs.push(actvPair);
          }
        }
        this.bulkUpdateCandles.clear();

        this.isInsertTimerScheduled = false;

        if (missedCandlePairs.length > 0) {
          logger.warn(`Candle-stick missed. Pairs - ${missedCandlePairs.join(", ")}`);
          const candles = await this._fetchAndFillCandleNow(missedCandlePairs);
          await new Promise((res) => setTimeout(res, 100));
          for (const candle of candles) {
            currentCandles.push(candle);
          }
          logger.info(`Reconciled missed canldes. Pairs - ${missedCandlePairs.join(", ")}`);
        }
        await this._saveToDB(currentCandles);
      }, 1500);
    }
  }

  async _fetchAndFillCandleNow(missedCandlePairs) {
    const timestamp = Math.floor(Date.now() / (2 * 60 * 1000)) * (2 * 60 * 1000) - 2 * 60 * 1000;
    const start = timestamp - 60 * 1000;
    const end = timestamp + 60 * 1000;

    const fetchedCandles = [];
    for (const pair of missedCandlePairs) {
      const candles1min = await bitgetClient.getCandles(pair, start, end);
      const candle1 = this._getCandleFromData(candles1min[0]);
      const candle2 = this._getCandleFromData(candles1min[1]);
      const candle2min = this._getMergeCande(candle1, candle2, pair);
      fetchedCandles.push(candle2min);
    }
    return fetchedCandles;
  }

  async _saveToDB(candles) {
    try {
      const insetingArray = [];
      for (const candle of candles) {
        insetingArray.push([
          candle.startTime,
          candle.open,
          candle.high,
          candle.low,
          candle.close,
          candle.volume,
          candle.pair,
        ]);
      }

      // Call redis publisher to send data to scalper

      await new Promise((res) => setTimeout(res, 300));
      await dbOperations.insertCandles({ missingCandles: insetingArray });
      //   logger.info(`Inserted : ${new Date(candle.startTime).toISOString()} - ${pair}`);
    } catch (err) {
      logger.error(err);
    }
  }

  _get2candleFromArray(data) {
    const t1 = parseFloat(data[0][0]);
    const t2 = parseFloat(data[1][0]);
    // if (t1 === t2) {
    //   console.log("t1 === t2");
    //   process.exit();
    // }
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

  _getMergeCande(candle1, candle2, pair) {
    const merged = {
      startTime: candle1.startTime,
      open: candle1.open,
      high: Math.max(candle1.high, candle2.high),
      low: Math.min(candle1.low, candle2.low),
      close: candle2.close,
      volume: candle1.volume + candle2.volume,
      pair,
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

module.exports = new Accumulator();
