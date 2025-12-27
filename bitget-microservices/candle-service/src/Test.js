const dbOperations = require("./db.operations");

class Test {
  async testCandles() {
    // const pairs = await this.getCandleListeningPairs();
    const pairs = ["SOLUSDT"];
    for (const pair of pairs) {
      await this.evaluateCandlesIntegrity(pair);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  async evaluateCandlesIntegrity(pair) {
    console.log("\n\n\n\n");

    const timeStampOf12hoursBeforeCandle =
      Math.floor(Date.now() / (2 * 60 * 1000)) * (2 * 60 * 1000) - 2 * 60 * 1000 * 30 * 12;
    const timestamps = await dbOperations.getDBTimestampsLast12Hours(pair, timeStampOf12hoursBeforeCandle);

    // this.printTimestamps(
    //   pair,
    //   timestamps.map((c) => c.timestamp),
    // );

    this.checkIntegrity(timestamps, pair);
  }

  checkIntegrity(timestamps, pair) {
    const numberOfCandles = timestamps.length;
    const startTimestamp = Math.min(...timestamps);
    const endTimestamp = Math.max(...timestamps);
    const timestampsSet = new Set(timestamps);

    const isValidStartTimestamp = (startTimestamp / (60 * 1000)) % 2 === 0;
    const isValidEndTimestamp = (endTimestamp / (60 * 1000)) % 2 === 0;

    console.log(`----------- ${pair}: CANDLE STICK REPORT (last 12 hours candle's) -----------`);

    if (!isValidStartTimestamp) {
      console.warn(`startTimestamp (${new Date(startTimestamp).toString()}) is not valid (odd minute)`);
      console.log(startTimestamp);
      return;
    }

    if (!isValidEndTimestamp) {
      console.warn(`endTimestamp (${new Date(endTimestamp).toString()}) is not valid (odd minute)`);
      console.log(endTimestamp);
      return;
    }

    let duplicateTimestamps = timestamps.length - timestampsSet.size;

    if (duplicateTimestamps > 0) {
      console.warn(`Number of duplicate timestamps: ${duplicateTimestamps}`);
      return;
    }

    let oddTimestamps = 0;
    for (const ts of timestampsSet) {
      if ((ts / (60 * 1000)) % 2 === 1) oddTimestamps++;
    }

    if (oddTimestamps > 0) {
      console.warn(`Invalid: ${oddTimestamps} odd timestamps found`);
      return;
    }

    // Calculate expected number of timestamps between start and end
    const expectedCandles = Math.floor((endTimestamp - startTimestamp) / (2 * 60 * 1000)) + 1;
    let notFoundTimestamps = 0;

    for (let i = 0; i < expectedCandles; i++) {
      const ts = startTimestamp + i * (2 * 60 * 1000);
      if (!timestampsSet.has(ts)) {
        notFoundTimestamps++;
      }
    }

    if (notFoundTimestamps > 0) {
      console.warn(`Found ${notFoundTimestamps} missing timestamps`);
      return;
    }

    const timeStampOf12hoursBeforeCandle =
      Math.floor(Date.now() / (2 * 60 * 1000)) * (2 * 60 * 1000) - 2 * 60 * 1000 * 30 * 12;
    const timeStampOfLastClosed = Math.floor(Date.now() / (2 * 60 * 1000)) * (2 * 60 * 1000) - 2 * 60 * 1000;
    const isAll12hCovered = timeStampOf12hoursBeforeCandle === startTimestamp && timeStampOfLastClosed === endTimestamp;

    if (!isAll12hCovered) {
      console.warn(
        `Not-covered; Last 12 hours candles are not covered. Missings are ${30 * 12 - numberOfCandles} candles.`,
      );
      return;
    }

    // console.log(`12 hours DB Candles timestamps: ${numberOfCandles}`);
    // console.log(`Start Candle Time: ${new Date(startTimestamp).toString()}`);
    // console.log(`End Candle Time: ${new Date(endTimestamp).toString()}`);
    // console.log("All the Candles are valid.");
    // console.log(`Number of Duplicate timestamps: ${duplicateTimestamps}`);
    // console.log(`Number of not found Candles timestamps: ${notFoundTimestamps}`);
    console.log(`------------------------------------OK------------------------------------`);
    console.log("\n\n");
  }

  async getCandleListeningPairs() {
    const pairs = await dbOperations.getCandleListeningPairs();
    return pairs;
  }

  printTimestamps(pair, ts) {
    console.log(`Printing ${ts.length} timestams for ${pair}`);
    if (ts.length === 0) {
      console.log(`From --; To --`);
      return;
    }
    const maxTimest = new Date(Math.max(...ts)).toISOString();
    const minTimest = new Date(Math.min(...ts)).toISOString();

    console.log(`From: ${minTimest} To: ${maxTimest}`);
  }
}

module.exports = new Test();
