const logger = require("../logger");
const CandleIntegrity = require("./Test.candleIntegrity");
const Interval = 30_000;

const schedular = async (candleService) => {
  try {
    await candleService.evaluateCandleListeningPairs();
  } catch (err) {
    logger.error("Error in evaluating candle listening pairs.");
  }
  setInterval(async () => {
    try {
      await candleService.evaluateCandleListeningPairs();
    } catch (err) {
      logger.error(`Error in evaluating candle listening pairs. Error : ${err}`);
    }
  }, Interval);

  const delayMS = Math.floor(Date.now() / (2 * 60 * 1000)) * (2 * 60 * 1000) + 2 * 60 * 1000 - Date.now() + 10 * 1000;
  await new Promise((res) => setTimeout(res, delayMS));
  setInterval(async () => {
    try {
      await CandleIntegrity.testCandles();
    } catch (err) {
      logger.error(`Error in candles's integrity testing. Error : ${err}`);
    }
  }, 2 * 60 * 1000);
};

module.exports = schedular;
