require("dotenv").config();
const logger = require("../logger");
const candleBackfill = require("./candle.backfill");
const connectDB = require("./db");
const Test = require("./Test");
// require("./schedular");

(async () => {
  await connectDB();
  logger.info("Started successfully");
  await candleBackfill.backfillMissingCandles("BTCUSDT");

  setInterval(async () => {
    await Test.testCandles();
  }, 20_000);
})();
