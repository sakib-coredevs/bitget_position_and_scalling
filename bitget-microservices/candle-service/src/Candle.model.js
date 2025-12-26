const { Schema, model } = require("mongoose");

const candle2mSchema = new Schema({
  pair: { type: String, required: true },
  open: { type: Number, required: true },
  close: { type: Number, required: true },
  high: { type: Number, required: true },
  low: { type: Number, required: true },
  volume: { type: Number, required: true },
  timestamp: { type: Date, required: true },
});

candle2mSchema.index({ pair: 1, timestamp: 1 }, { unique: true });
candle2mSchema.index({ timestamp: 1 });
candle2mSchema.index({ pair: 1 });
candle2mSchema.index({ pair: 1, timestamp: -1 });

module.exports = model("Candle2m", candle2mSchema);
