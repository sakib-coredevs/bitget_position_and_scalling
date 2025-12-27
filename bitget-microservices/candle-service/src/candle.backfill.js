const bitgetClient = require("./bitget.client");
const dbOperations = require("./db.operations");
const nowCandleTimestamp = require("./utils/nowCandleTimestamp");

class CandleBackfill {
  async backfillMissingCandles(symbol) {
    const timeStampOf12hoursBeforeCandle =
      Math.floor(Date.now() / (2 * 60 * 1000)) * (2 * 60 * 1000) - 2 * 60 * 1000 * 30 * 12;
    const savedTimeStamps = await dbOperations.getDBTimestampsLast12Hours(symbol, timeStampOf12hoursBeforeCandle);

    this.printTimestamp(`Fetched db timestamps for ${symbol}`, savedTimeStamps);

    const missingTimestamps = this.identifyMissingTimestamps(savedTimeStamps);
    const leastTimestamp = Math.min(...missingTimestamps);
    const maxTimestamp = Math.max(...missingTimestamps);

    if (missingTimestamps.length === 0) return;

    const candles = await this.getBitget2mCandles(symbol, leastTimestamp, maxTimestamp);

    console.log(`Fetched ${candles.length} 2m candles from Bitget, backfilling for ${symbol}`);
    // console.log(`Fetched Candles: ${candles.map((candle) => candle.timestamp).join(", ")}`);

    const missingTimeStampsSet = new Set(missingTimestamps);
    const missingCandles = candles.filter((candle) => {
      return missingTimeStampsSet.has(candle[0]);
    });

    // console.log(`Filtered Candles for Insertion: ${missingCandles.map((candle) => candle[0]).join(", ")}`);
    console.log(`Filtered ${missingCandles.length} candles to DB insertion for ${symbol}`);

    const result = await dbOperations.insertCandles(symbol, missingCandles);
    console.log(`Insertion result : ${JSON.stringify(result)}`);

    if (result.inserted === missingCandles.length) {
      console.log(`Saved all missing candles for ${symbol}`);
    } else {
      const errorMess = `PAIR: ${symbol}: Missing candles are ${missingCandles.length}; Inserted into DB are ${result.inserted}`;
      //   console.error(errorMess);
      //   throw new Error(errorMess);
    }
  }

  identifyMissingTimestamps(savedTimeStamps) {
    // Logic to identify missing timestamps
    const allExpectedTimestamps = [];

    const savedTimestampsSet = new Set(savedTimeStamps);

    // console.log(`Saved Timestamps: ${[...savedTimestampsSet].join(", ")}`);

    const last2mClosedCandleTimestamp = Math.floor(Date.now() / (2 * 60 * 1000)) * (2 * 60 * 1000) - 2 * 60 * 1000;

    const numberOfCandles = 12 * 30;

    for (let i = 0; i < numberOfCandles; i++) {
      const timestamp = last2mClosedCandleTimestamp - 2 * 60 * 1000 * i;
      allExpectedTimestamps.push(timestamp);
    }

    // console.log(`All Valid Timestamps: ${[...allExpectedTimestamps].join(", ")}`);

    const missingTimestamps = [];

    for (const timestamp of allExpectedTimestamps) {
      if (!savedTimestampsSet.has(timestamp)) {
        missingTimestamps.push(timestamp);
      }
    }

    // console.log(`Missing Timestamps: ${missingTimestamps.join(", ")}`);

    console.log(`All valid timestamp len: ${allExpectedTimestamps.length}`);
    console.log(`Missing timestamp len: ${missingTimestamps.length}`);
    console.log(`Saved timestamp len: ${savedTimestampsSet.size}`);

    return missingTimestamps;
  }

  async getBitget2mCandles(symbol, startTimestamp, endTimestamp) {
    console.log(`Expected 2m startcandle ${new Date(startTimestamp).toString()}`);
    console.log(`Expected 2m endcandle ${new Date(endTimestamp).toString()}`);

    const start = startTimestamp - 60 * 1000;
    const end = endTimestamp + 60 * 1000;

    const candles1min = await bitgetClient.getCandles(symbol, start, end);

    console.log(`Fetched ${candles1min.length} 1-min candles from Bitget.`);

    console.log(`Bitget 1m startcandle ${new Date(parseFloat(candles1min[0][0])).toString()}`);
    console.log(`Bitget 1m endcandle ${new Date(parseFloat(candles1min[candles1min.length - 1][0])).toString()}`);

    const candles2min = this.convertInto2mCandles(candles1min);

    // verify

    if (candles2min[0][0] !== startTimestamp) {
      console.log("start timestamp not matched after conversion");
      throw new Error("start timestamp not matched after conversion");
    }
    if (candles2min[candles2min.length - 1][0] !== endTimestamp) {
      console.log("end timestamp not matched after conversion");
      throw new Error("end timestamp not matched after conversion");
    }

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
          parseFloat(candle1[5]) + parseFloat(candle2[5]), // quote volume
        ];
        converted.push(merged);
      }
    }
    return converted;
  }

  printTimestamp(timestampfor, timestamps) {
    const len = timestamps.length;
    const firstTimestamp = timestamps[0] ? new Date(timestamps[0]).toISOString() : "NULL";
    const lastTimestamp = timestamps[len - 1] ? new Date(timestamps[len - 1]).toISOString() : "NULL";
    console.log(timestampfor);
    console.log(`Total ${len} timestams; ${firstTimestamp} - ${lastTimestamp}`);
  }
}
module.exports = new CandleBackfill();
