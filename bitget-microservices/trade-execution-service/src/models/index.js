// models/index.js
const mongoose = require("mongoose");

// Order Schema
const orderSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, unique: true },
    symbol: { type: String, required: true },
    side: { type: String, enum: ["buy", "sell"], required: true },
    orderType: { type: String, enum: ["market", "limit"], required: true },
    size: { type: Number, required: true },
    price: { type: Number },
    status: {
      type: String,
      enum: ["pending", "filled", "cancelled", "rejected", "partial"],
      default: "pending",
    },
    filledSize: { type: Number, default: 0 },
    avgPrice: { type: Number, default: 0 },
    paperTrade: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  },
);

orderSchema.index({ symbol: 1, timestamp: -1 });
orderSchema.index({ paperTrade: 1 });

// Trade Schema
const tradeSchema = new mongoose.Schema(
  {
    tradeId: { type: String, required: true, unique: true },
    orderId: { type: String, required: true },
    symbol: { type: String, required: true },
    side: { type: String, enum: ["buy", "sell"], required: true },
    size: { type: Number, required: true },
    price: { type: Number, required: true },
    fee: { type: Number, default: 0 },
    paperTrade: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  },
);

tradeSchema.index({ symbol: 1, timestamp: -1 });
tradeSchema.index({ orderId: 1 });

// Position Schema
const positionSchema = new mongoose.Schema(
  {
    symbol: { type: String, required: true, unique: true },
    side: { type: String, enum: ["long", "short", "net"], required: true },
    size: { type: Number, required: true },
    avgPrice: { type: Number, required: true },
    unrealizedPnl: { type: Number, default: 0 },
    realizedPnl: { type: Number, default: 0 },
    leverage: { type: Number, default: 1 },
    marginMode: { type: String, enum: ["isolated", "crossed"], default: "isolated" },
    liquidationPrice: { type: Number },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  },
);

positionSchema.index({ symbol: 1 });

// Insight Schema (for analytics and logging)
const insightSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "trade_executed",
        "paper_trade",
        "position_opened",
        "position_closed",
        "account_update",
        "risk_alert",
        "performance_metric",
      ],
      required: true,
    },
    symbol: { type: String },
    side: { type: String },
    size: { type: Number },
    price: { type: Number },
    coin: { type: String },
    available: { type: Number },
    equity: { type: Number },
    message: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed },
    timestamp: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  },
);

insightSchema.index({ type: 1, timestamp: -1 });
insightSchema.index({ symbol: 1, timestamp: -1 });

// Account Balance Schema
const accountSchema = new mongoose.Schema(
  {
    coin: { type: String, required: true },
    available: { type: Number, required: true },
    equity: { type: Number, required: true },
    frozen: { type: Number, default: 0 },
    unrealizedPnl: { type: Number, default: 0 },
    marginRatio: { type: Number },
    timestamp: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  },
);

accountSchema.index({ coin: 1, timestamp: -1 });

// Strategy Performance Schema
const performanceSchema = new mongoose.Schema(
  {
    strategyName: { type: String, required: true },
    totalTrades: { type: Number, default: 0 },
    winningTrades: { type: Number, default: 0 },
    losingTrades: { type: Number, default: 0 },
    winRate: { type: Number, default: 0 },
    totalPnl: { type: Number, default: 0 },
    avgWin: { type: Number, default: 0 },
    avgLoss: { type: Number, default: 0 },
    profitFactor: { type: Number, default: 0 },
    sharpeRatio: { type: Number },
    maxDrawdown: { type: Number, default: 0 },
    startDate: { type: Date },
    endDate: { type: Date },
    paperTrade: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  },
);

performanceSchema.index({ strategyName: 1, paperTrade: 1 });

module.exports = {
  Order: mongoose.model("Order", orderSchema),
  Trade: mongoose.model("Trade", tradeSchema),
  Position: mongoose.model("Position", positionSchema),
  Insight: mongoose.model("Insight", insightSchema),
  Account: mongoose.model("Account", accountSchema),
  Performance: mongoose.model("Performance", performanceSchema),
};
