const mongoose = require("mongoose");

const pairSchema = new mongoose.Schema(
  {
    exchange: { type: String, required: true },
    symbol: { type: String, required: true, unique: true },
    baseCoin: String,
    quoteCoin: String,
    volume24h: { type: Number, default: 0 },
    buyLimitPriceRatio: { type: Number, default: 0 },
    sellLimitPriceRatio: { type: Number, default: 0 },
    feeRateUpRatio: { type: Number, default: 0 },
    makerFeeRate: { type: Number, default: 0 },
    takerFeeRate: { type: Number, default: 0 },
    minTradeNum: { type: Number, default: 0 },
    priceEndStep: { type: Number, default: 0 },
    volumePlace: { type: Number, default: 0 },
    pricePlace: { type: Number, default: 0 },
    sizeMultiplier: { type: Number, default: 0 },
    openCostUpRatio: { type: Number, default: 0 },
    minTradeUSDT: { type: Number, default: 0 },
    fundInterval: { type: Number, default: 0 },
    minLever: { type: Number, default: 1 },
    maxLever: { type: Number, default: 10 },
    posLimit: { type: Number, default: 0 },
    tradable: {
      type: Boolean,
      default: false,
    },
    phase: { type: String, default: "one", enum: ["one", "two", "three"] },
  },
  { timestamps: true },
);

pairSchema.index({ volume24h: 1, tradable: 1 });
pairSchema.index({ symbol: 1 });
pairSchema.index({ phase: 1 });

module.exports = mongoose.model("FuturesPair", pairSchema);
