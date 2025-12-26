const candleService = require("./candle.service");
const Interval = 20_000;

setInterval(async () => {
  try {
    await candleService.evaluateCandleListeningPairs();
  } catch {
    console.log("Error in evaluating candle listening pairs.");
  }
}, Interval);
