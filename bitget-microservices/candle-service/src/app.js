require("dotenv").config();
const logger = require("../logger");
const candleBackfill = require("./candle.backfill");
const connectDB = require("./db");
const CandleStickClientManager = require("./manager");
const CandleIntegrity = require("./Test.candleIntegrity");
const CandleService = require("./candle.service");
const schedular = require("./schedular");

(async () => {
  try {
    await connectDB();
    const candlemangr = new CandleStickClientManager();
    await candlemangr.start();
    const cadlSrvc = new CandleService(candlemangr);
    schedular(cadlSrvc);

    logger.info("Started successfully");
    // await candleBackfill.backfillMissingCandles("PIPPINUSDT");

    setInterval(async () => {
      await CandleIntegrity.testCandles();
    }, 40_000);
  } catch (err) {
    logger.error("Can't start the candle-service");
    console.log(err);
  }
})();
