const candleBackfill = require("./candle.backfill");
const dbOperations = require("./db.operations");

class CandleService {
  constructor() {
    this.candleListeningPairs = new Set();
  }

  //   async setCandleListeningPairsInitially() {
  //     const pairs = await this.getCandleListeningPairs();
  //     for (const symbol of pairs) {
  //       this.candleListeningPairs.add(symbol);
  //     }
  //   }

  async evaluateCandleListeningPairs() {
    try {
      const pairs = await this.getCandleListeningPairs();
      const newPairs = this.getNewCandleListeningPairs(pairs);
      const stoppedPairs = this.getStoppedCandleListeningPairs(pairs);

      console.log("Evaluating candle listening pairs...");
      console.log(`Current candle listening pairs: ${[...this.candleListeningPairs].join(", ")}`);
      console.log(`New candle listening pairs: ${newPairs.join(", ")}`);
      console.log(`Stopped candle listening pairs: ${stoppedPairs.join(", ")}`);

      for (const symbol of newPairs) {
        this.addCandleListeningPair(symbol);
      }

      for (const symbol of stoppedPairs) {
        this.removeCandleListeningPair(symbol);
      }

      this.turnOnCandleListening(newPairs);

      this.turnOffCandleListening(stoppedPairs);
    } catch (error) {
      console.error("Error evaluating candle listening pairs");
      console.log(error);
    }
  }

  turnOnCandleListening(symbols) {
    let i = 0;
    for (const symbol of symbols) {
      // Logic to turn on candle listening for the symbol

      const mostImmediateCandleTimestampNext = Math.floor(Date.now() / (2 * 60 * 1000)) * 2 * 60 * 1000 + 2 * 60 * 1000;

      const callBackDelay = mostImmediateCandleTimestampNext - Date.now() + i * 5000;
      console.log(`Turning on candle listening for ${symbol} after ${callBackDelay / 1000}s`);

      setTimeout(async () => {
        await candleBackfill.backfillMissingCandles(symbol);
      }, callBackDelay);

      i++;
    }
  }

  turnOffCandleListening(symbols) {
    for (const symbol of symbols) {
      // Logic to turn off candle listening for the symbol
    }
  }

  async getCandleListeningPairs() {
    const pairs = await dbOperations.getCandleListeningPairs();
    return pairs;
  }

  getNewCandleListeningPairs(latestPairs) {
    const newPairs = [];
    for (const symbol of latestPairs) {
      if (!this.candleListeningPairs.has(symbol)) {
        newPairs.push(symbol);
      }
    }
    return newPairs;
  }

  getStoppedCandleListeningPairs(latestPairs) {
    const stoppedPairs = [];
    for (const symbol of this.candleListeningPairs) {
      if (!latestPairs.includes(symbol)) {
        stoppedPairs.push(symbol);
      }
    }
    return stoppedPairs;
  }

  addCandleListeningPair(symbol) {
    this.candleListeningPairs.add(symbol);
  }

  removeCandleListeningPair(symbol) {
    this.candleListeningPairs.delete(symbol);
  }

  isCandleListeningPair(symbol) {
    return this.candleListeningPairs.has(symbol);
  }
}

module.exports = new CandleService();
