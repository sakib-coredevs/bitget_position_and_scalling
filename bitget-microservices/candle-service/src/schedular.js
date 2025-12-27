const Interval = 20_000;

const schedular = (candleService) => {
  setInterval(async () => {
    try {
      await candleService.evaluateCandleListeningPairs();
    } catch {
      console.log("Error in evaluating candle listening pairs.");
    }
  }, Interval);
};

module.exports = schedular;
