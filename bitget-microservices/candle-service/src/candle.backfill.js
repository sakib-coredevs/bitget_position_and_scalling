const bitgetClient = require("./bitget.client");
const dbOperations = require("./db.operations");
const nowCandleTimestamp = require("./utils/nowCandleTimestamp");

class CandleBackfillService {
  async backfillMissingCandles(symbol) {
    const mostLast12hoursBeforeTimestamp =
      Math.floor(Date.now() / (2 * 60 * 1000)) * (2 * 60 * 1000) - 2 * 60 * 1000 * 30 * 12;
    const savedTimeStamps = await dbOperations.getSavedCandlesLast12Hours(symbol, mostLast12hoursBeforeTimestamp);

    const missingTimestamps = this.identifyMissingTimestamps(savedTimeStamps);
    const leastTimestamp = Math.min(...missingTimestamps);
    const maxTimestamp = Math.max(...missingTimestamps);

    const candles = await this.get2mCandles(symbol, leastTimestamp, maxTimestamp);

    const converted2mCandles = this.convertInto2mCandles(candles);

    console.log(`Fetched ${candles.length} candles from Bitget for backfilling.`);
    console.log(`Fetched Candles: ${candles.map((candle) => candle.timestamp).join(", ")}`);

    const missingCandleSet = new Set(missingTimestamps);
    const filteredCandles = candles.filter((candle) => {
      return missingCandleSet.has(candle.timestamp);
    });

    console.log(`Filtered Candles for Insertion: ${filteredCandles.map((candle) => candle.timestamp).join(", ")}`);

    // await dbOperations.insertMissingCandles(symbol, filteredCandles);
  }

  identifyMissingTimestamps(savedTimeStamps) {
    // Logic to identify missing timestamps
    const allValidTimestamps = [];

    const savedTimestampsSet = new Set(savedTimeStamps);

    console.log(`Saved Timestamps: ${[...savedTimestampsSet].join(", ")}`);

    const mostRecentlyClosedCandleTimestamp =
      Math.floor(Date.now() / (2 * 60 * 1000)) * (2 * 60 * 1000) - 2 * 60 * 1000;

    const numberOfCandles = 12 * 30;

    for (let i = 0; i < numberOfCandles; i++) {
      const timestamp = mostRecentlyClosedCandleTimestamp - 2 * 60 * 1000 * i;
      allValidTimestamps.push(timestamp);
    }

    console.log(`All Valid Timestamps: ${[...allValidTimestamps].join(", ")}`);

    const missingTimestamps = [];

    for (const timestamp of allValidTimestamps) {
      if (!savedTimestampsSet.has(timestamp)) {
        missingTimestamps.push(timestamp);
      }
    }

    console.log(`Missing Timestamps: ${missingTimestamps.join(", ")}`);

    console.log(`All valid timestamp len: ${allValidTimestamps.length}`);
    console.log(`Missing timestamp len: ${missingTimestamps.length}`);
    console.log(`Saved timestamp len: ${savedTimestampsSet.size}`);

    return missingTimestamps;
  }

  async get2mCandles(symbol, startTimestamp, endTimestamp) {
    const start = startTimestamp - 60 * 1000;
    const end = endTimestamp + 60 * 1000;

    const candles1min = await bitgetClient.getCandles(symbol, start, end);

    const candles2min = this.convertInto2mCandles(candles1min);
    return candles2min;
  }

  convertInto2mCandles(candles) {
    const converted = [];
    for (let i = 0; i < candles.length; i += 2) {
      const candle1 = candles[i];
      const candle2 = candles[i + 1];
      if (candle2) {
        const merged = [
          parseFloat(candle1[0]), // timestamp
          parseFloat(candle1[1]), // entry price
          Math.max(parseFloat(candle1[2]), parseFloat(candle2[2])), // max price
          Math.min(parseFloat(candle1[3]), parseFloat(candle2[3])), // min price
          parseFloat(candle2[4]), // latest price
        ];
        converted.push(merged);
      }
    }
    return converted;
  }
}
module.exports = new CandleBackfillService();
