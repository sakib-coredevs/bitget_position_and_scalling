const bitgetClient = require("./bitget.client");

async function fetchAndFillCandleNow() {
  const missedCandlePairs = ["SOLUSDT", "BTCUSDT", "ETHUSDT", "SQDUSDT"];
  const timestamp = Math.floor(Date.now() / (2 * 60 * 1000)) * (2 * 60 * 1000) - 2 * 60 * 1000;
  const start = timestamp - 60 * 1000;
  const end = timestamp + 60 * 1000;

  for (const pair of missedCandlePairs) {
    const candles1min = await bitgetClient.getCandles(pair, start, end);
    console.log(candles1min.map((candle) => new Date(parseFloat(candle[0]))));
  }
}

(async () => {
  await fetchAndFillCandleNow();
})();
