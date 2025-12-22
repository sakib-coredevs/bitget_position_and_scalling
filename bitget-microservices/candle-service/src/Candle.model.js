const { Schema } = require("mongoose");

const candleSchema = new Schema({
  pair: { type: Schema.Types.ObjectId, ref: "FuturesPair", required: true },
  open: { type: Number, required: true },
  close: { type: Number, required: true },
  high: { type: Number, required: true },
  low: { type: Number, required: true },
  volume: { type: Number, required: true },
  timestamp: { type: Date, required: true },
});

candleSchema.index({ pair: 1, timestamp: 1 }, { unique: true });
candleSchema.index({ timestamp: 1 });
candleSchema.index({ pair: 1 });
candleSchema.index({ pair: 1, timestamp: -1 });

module.exports = mongoose.model("Candle", candleSchema);
