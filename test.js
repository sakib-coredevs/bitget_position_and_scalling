const bitgetClient = require("./bitget-microservices/candle-service/src/bitget.client");

(async () => {
  const symbol = "BTCUSDT";

  const paddingMinutes = 0;

  const howManyCandlesDoIWant = 3;

  const maxTimestamp =
    Math.floor(Date.now() / (1000 * 60 * 2)) * (1000 * 60 * 2) - paddingMinutes * 60 * 1000 - 60 * 1000;

  const leastTimestamp = maxTimestamp - howManyCandlesDoIWant * 1000 * 60 * 2;

  console.log(`Fetching candles from`);
  console.log(new Date(leastTimestamp));
  console.log("to");
  console.log(new Date(maxTimestamp));

  const candles = await bitgetClient.getCandles(symbol, leastTimestamp, maxTimestamp);

  const ttts = candles.map((candle) => new Date(parseFloat(candle[0])));
  console.log(ttts);

  console.log(`Fetched ${candles.length} candles from Bitget.`);

  const convertedCandles = convertInto2mCandles(candles);
  printCandles(convertedCandles);
})();

function printCandles(candles) {
  const timestamps = [];
  candles.forEach((candle) => {
    const time = new Date(parseInt(candle[0]));
    // console.log(`Candle: ${JSON.stringify(candle)}`);
    timestamps.push(time);
  });
  console.log(timestamps);
  console.log(candles);
}

function convertInto2mCandles(candles) {
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
