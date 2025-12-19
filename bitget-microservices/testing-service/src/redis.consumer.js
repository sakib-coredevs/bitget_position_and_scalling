const Redis = require("ioredis");

const redis = new Redis(process.env.REDIS_URL);

redis.subscribe("NEW_FUTURES_PAIR", (err) => {
  if (err) {
    console.error("Redis subscribe failed", err);
  } else {
    console.log("Subscribed to NEW_FUTURES_PAIR");
  }
});

redis.subscribe("PAIR_TRADABLE_ON", (err) => {
  if (err) {
    console.error("Redis subscribe failed", err);
  } else {
    console.log("Subscribed to PAIR_TRADABLE_ON");
  }
});

redis.subscribe("PAIR_TRADABLE_OFF", (err) => {
  if (err) {
    console.error("Redis subscribe failed", err);
  } else {
    console.log("Subscribed to PAIR_TRADABLE_OFF");
  }
});

redis.on("message", (channel, message) => {
  if (channel === "NEW_FUTURES_PAIR") {
    const data = JSON.parse(message);

    console.log(`[TEST-SERVICE] New pair received: ${data.exchange} ${data.symbol}`);
  }
});

redis.on("message", (channel, message) => {
  if (channel === "PAIR_TRADABLE_ON") {
    const data = JSON.parse(message);

    console.log(`[TEST-SERVICE] Pair Tradable ON received: ${data.exchange} ${data.symbol}`);
  }
});

redis.on("message", (channel, message) => {
  if (channel === "PAIR_TRADABLE_OFF") {
    const data = JSON.parse(message);

    console.log(`[TEST-SERVICE] Pair Tradable OFF received: ${data.exchange} ${data.symbol}`);
  }
});
