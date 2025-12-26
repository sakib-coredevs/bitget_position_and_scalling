const redis = require("./redis");

redis.subscribe("PAIR_CANDLE_LISTENING_ON", (err) => {
  if (err) {
    console.error("Redis subscribe failed", err);
  } else {
    console.log("Subscribed to PAIR_CANDLE_LISTENING_ON");
  }
});

redis.subscribe("PAIR_CANDLE_LISTENING_OFF", (err) => {
  if (err) {
    console.error("Redis subscribe failed", err);
  } else {
    console.log("Subscribed to PAIR_CANDLE_LISTENING_OFF");
  }
});

redis.on("message", (channel, message) => {
  if (channel === "PAIR_CANDLE_LISTENING_ON") {
    const data = JSON.parse(message);

    console.log(`[CANDLE-SERVICE] Pair Candle Listening ON received: ${data.exchange} ${data.symbol}`);
  }
});

redis.on("message", (channel, message) => {
  if (channel === "PAIR_CANDLE_LISTENING_OFF") {
    const data = JSON.parse(message);

    console.log(`[CANDLE-SERVICE] Pair Candle Listening OFF received: ${data.exchange} ${data.symbol}`);
  }
});
