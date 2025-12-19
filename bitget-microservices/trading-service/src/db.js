const mongoose = require("mongoose");

const FuturesTradeSchema = new mongoose.Schema(
  {
    exchange: {
      type: String,
      enum: ["BITGET"],
      required: true,
      index: true,
    },

    symbol: {
      type: String,
      required: true,
      index: true,
    },

    orderId: {
      type: String,
      required: true,
      index: true,
    },

    tradeId: {
      type: String,
      required: true,
      unique: true,
    },

    didStopLossTrigger: {
      type: Boolean,
      default: false,
    },

    side: {
      type: String,
      enum: ["BUY", "SELL"],
      required: true,
    },

    stopLoss: {
      type: Number,
      required: true,
    },

    takeProfit: {
      type: Number,
      required: true,
    },

    positionSide: {
      type: String,
      enum: ["LONG", "SHORT"],
      required: true,
      index: true,
    },

    reduceOnly: {
      type: Boolean,
      default: false,
    },

    price: {
      type: Number,
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
    },

    quoteQuantity: {
      type: Number,
    },

    fee: {
      type: Number,
      default: 0,
    },

    feeCurrency: {
      type: String,
    },

    realizedPnl: {
      type: Number,
      default: 0,
    },

    orderType: {
      type: String,
      enum: ["MARKET", "LIMIT", "STOP", "TAKE_PROFIT"],
    },

    status: {
      type: String,
      enum: ["FILLED", "PARTIALLY_FILLED"],
      default: "FILLED",
    },

    strategy: {
      type: String,
      index: true,
    },

    botId: {
      type: String,
      index: true,
    },

    tradeTime: {
      type: Date,
      required: true,
      index: true,
    },

    raw: {
      type: Object,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("FuturesTrade", FuturesTradeSchema);
