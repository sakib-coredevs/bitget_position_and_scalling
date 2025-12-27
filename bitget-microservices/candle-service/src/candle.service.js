const candleBackfill = require("./candle.backfill");
const dbOperations = require("./db.operations");

class CandleService {
  constructor(candlemangr) {
    this.candleListeningPairsSet = new Set();
    this.erroredPairsOnTurningOn = [];
    this.candlemangr = candlemangr;
  }

  //   async setCandleListeningPairsInitially() {
  //     const pairs = await this.getCandleListeningPairs();
  //     for (const pair of pairs) {
  //       this.candleListeningPairsSet.add(pair);
  //     }
  //   }

  async evaluateCandleListeningPairs() {
    try {
      const pairs = await this.getCandleListeningPairs();
      const newPairs = this.getNewCandleListeningPairs(pairs);
      const stoppedPairs = this.getStoppedCandleListeningPairs(pairs);

      //   console.log("Evaluating candle listening pairs...");
      //   console.log(`Current candle listening pairs: ${[...this.candleListeningPairsSet].join(", ")}`);
      //   console.log(`New candle listening pairs: ${newPairs.join(", ")}`);
      //   console.log(`Stopped candle listening pairs: ${stoppedPairs.join(", ")}`);

      for (const pair of newPairs) {
        this.addCandleListeningPair(pair);
      }

      for (const pair of stoppedPairs) {
        this.removeCandleListeningPair(pair);
      }

      this.turnOnCandleListening(newPairs);

      this.turnOffCandleListening(stoppedPairs);
    } catch (error) {
      console.error("Error evaluating candle listening pairs");
      console.log(error);
    }
  }

  turnOnCandleListening(pairs) {
    const chunkArray = this.getChunkArray(pairs, 5);
    let j = 0;
    for (const pairChunk of chunkArray) {
      let i = 0;
      const nextJth2mCandleTimestamp =
        Math.floor(Date.now() / (2 * 60 * 1000)) * 2 * 60 * 1000 + 2 * 60 * 1000 * (j + 1);
      for (const pair of pairChunk) {
        const callBackDelay = nextJth2mCandleTimestamp - Date.now() + i * 10_000;
        console.log(`Turning on candle listening for ${pair} after ${callBackDelay / 1000}s`);

        setTimeout(
          async () => {
            try {
              await candleBackfill.backfillMissingCandles(pair);
              await new Promise((res) => setTimeout(res, 2000));
              await this.candlemangr.subscribe(pair);
              console.log(`Turning on ${pair} has completed!`);
            } catch (err) {
              console.log(`Turning on ${pair} not completed!`);
              console.log(err);
              if (!this.erroredPairsOnTurningOn.includes(pair)) {
                this.erroredPairsOnTurningOn.push(pair);
                setTimeout(() => this.turnOnCandleListening([pair]), 5_000);
              }
            }
          },
          callBackDelay,
          pair,
        );
        i++;
      }
      j++;
    }
  }

  turnOffCandleListening(pairs) {
    for (const pair of pairs) {
      // Logic to turn off candle listening for the pair
    }
  }

  async getCandleListeningPairs() {
    const pairs = await dbOperations.getCandleListeningPairs();
    return pairs;
  }

  getNewCandleListeningPairs(latestPairs) {
    const newPairs = [];
    for (const pair of latestPairs) {
      if (!this.candleListeningPairsSet.has(pair)) {
        newPairs.push(pair);
      }
    }
    return newPairs;
  }

  getStoppedCandleListeningPairs(latestPairs) {
    const stoppedPairs = [];
    for (const pair of this.candleListeningPairsSet) {
      if (!latestPairs.includes(pair)) {
        stoppedPairs.push(pair);
      }
    }
    return stoppedPairs;
  }

  getChunkArray(pairs, n) {
    const result = [];
    for (let i = 0; i < pairs.length; i += n) {
      result.push(pairs.slice(i, i + n));
    }
    return result;
  }

  addCandleListeningPair(pair) {
    this.candleListeningPairsSet.add(pair);
  }

  removeCandleListeningPair(pair) {
    this.candleListeningPairsSet.delete(pair);
  }

  isCandleListeningPair(pair) {
    return this.candleListeningPairsSet.has(pair);
  }
}

module.exports = CandleService;
