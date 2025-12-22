const nowCandleTimeStamp = require("./utils/nowCandleTimestamp");

const INTERVAL = 30_000;

setInterval(async () => {
  try {
    console.log("Current Candle Timestamp:", nowCandleTimeStamp());
  } catch (err) {
    console.error("Error in schedule: " + err.message);
  }
}, INTERVAL);
