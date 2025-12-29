// index.js - Main Entry Point
require("dotenv").config();
const mongoose = require("mongoose");
const BitgetTrader = require("./BitgetTrader");
const logger = require("../logger");

async function main() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    logger.info("MongoDB connected successfully");

    // Initialize trader
    const trader = new BitgetTrader({
      apiKey: process.env.BITGET_API_KEY,
      apiSecret: process.env.BITGET_API_SECRET,
      passphrase: process.env.BITGET_PASSPHRASE,
      paperTrade: process.env.PAPER_TRADE === "true",
    });

    // Start WebSocket connection
    await trader.connectWebSocket();
    logger.info("Trading engine started successfully");

    // Example: Place a market order
    // const order = await trader.placeOrder({
    //   symbol: 'BTCUSDT',
    //   side: 'buy',
    //   orderType: 'market',
    //   size: 0.01,
    //   marginMode: 'isolated',
    //   leverage: 10
    // });

    // Graceful shutdown
    process.on("SIGINT", async () => {
      logger.info("Shutting down gracefully...");
      await trader.disconnect();
      await mongoose.connection.close();
      process.exit(0);
    });
  } catch (error) {
    logger.error("Application error:", error);
    process.exit(1);
  }
}

main();
