// examples/trading-example.js
require("dotenv").config();
const BitgetTrader = require("./BitgetTrader");
const { Order, Trade, Position, Insight } = require("./models");
const mongoose = require("mongoose");

async function runExamples() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB connected");

    // Initialize trader in PAPER mode
    const trader = new BitgetTrader({
      apiKey: process.env.BITGET_API_KEY,
      apiSecret: process.env.BITGET_API_SECRET,
      passphrase: process.env.BITGET_PASSPHRASE,
      paperTrade: true, // Paper trading
    });

    // Connect WebSocket
    await trader.connectWebSocket();
    console.log("✅ WebSocket connected");

    // Wait for authentication
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Example 1: Market Buy Order
    console.log("\n📊 Example 1: Market Buy Order");
    const marketOrder = await trader.placeOrder({
      symbol: "BTCUSDT",
      side: "buy",
      orderType: "market",
      size: 0.01,
      marginMode: "isolated",
      leverage: 10,
    });
    console.log("Order placed:", marketOrder.orderId);

    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Example 2: Limit Sell Order
    console.log("\n📊 Example 2: Limit Sell Order");
    const limitOrder = await trader.placeOrder({
      symbol: "ETHUSDT",
      side: "sell",
      orderType: "limit",
      size: 0.1,
      price: 2500,
      marginMode: "crossed",
      leverage: 5,
    });
    console.log("Limit order placed:", limitOrder.orderId);

    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Example 3: Query Orders
    console.log("\n📊 Example 3: Query Recent Orders");
    const recentOrders = await Order.find().sort({ timestamp: -1 }).limit(5);
    console.log(`Found ${recentOrders.length} recent orders`);
    recentOrders.forEach((order) => {
      console.log(`  - ${order.symbol} ${order.side} ${order.size} @ ${order.price || "market"}`);
    });

    // Example 4: Query Trades
    console.log("\n📊 Example 4: Query Trades");
    const trades = await Trade.find({ paperTrade: true }).sort({ timestamp: -1 }).limit(5);
    console.log(`Found ${trades.length} paper trades`);
    trades.forEach((trade) => {
      console.log(`  - ${trade.symbol} ${trade.side} ${trade.size} @ ${trade.price}`);
    });

    // Example 5: Query Insights
    console.log("\n📊 Example 5: Query Insights");
    const insights = await Insight.find().sort({ timestamp: -1 }).limit(5);
    console.log(`Found ${insights.length} insights`);
    insights.forEach((insight) => {
      console.log(`  - ${insight.type}: ${insight.message}`);
    });

    // Example 6: Calculate Performance
    console.log("\n📊 Example 6: Performance Metrics");
    const allTrades = await Trade.find({ paperTrade: true });
    const totalPnL = allTrades.reduce((sum, trade) => {
      const multiplier = trade.side === "buy" ? -1 : 1;
      return sum + trade.size * trade.price * multiplier - trade.fee;
    }, 0);
    console.log(`Total Paper PnL: $${totalPnL.toFixed(2)}`);
    console.log(`Total Trades: ${allTrades.length}`);

    // Example 7: Get Current Positions
    console.log("\n📊 Example 7: Current Positions");
    const positions = await Position.find();
    console.log(`Active Positions: ${positions.length}`);
    positions.forEach((pos) => {
      console.log(`  - ${pos.symbol} ${pos.side} ${pos.size} @ ${pos.avgPrice}`);
      console.log(`    Unrealized PnL: $${pos.unrealizedPnl.toFixed(2)}`);
    });

    // Example 8: Risk Analysis
    console.log("\n📊 Example 8: Risk Analysis");
    const buyTrades = allTrades.filter((t) => t.side === "buy").length;
    const sellTrades = allTrades.filter((t) => t.side === "sell").length;
    console.log(`Buy Trades: ${buyTrades}`);
    console.log(`Sell Trades: ${sellTrades}`);

    // Wait a bit for WebSocket messages
    console.log("\n⏳ Waiting for WebSocket updates (10 seconds)...");
    await new Promise((resolve) => setTimeout(resolve, 10000));

    // Cleanup
    await trader.disconnect();
    await mongoose.connection.close();
    console.log("\n✅ Examples completed successfully!");
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

// Run examples
runExamples();
