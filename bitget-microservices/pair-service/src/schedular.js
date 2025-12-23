const logger = require("../logger");
const pairService = require("./pair.service");

const INTERVAL = 20_000;

setInterval(async () => {
  try {
    await pairService.syncBitgetPairs();
    await pairService.syncFuturesPairVolume24h();
    await pairService.evaluateTradablePairs();
    await pairService.evaluateCandleListeningPairs();
  } catch (err) {
    logger.error("Error in scheduler: " + err.message);
  }
}, INTERVAL);
