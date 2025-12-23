const Candle2m = require("./Candle.model");

class DbOperations {
  async getSavedCandlesLast12Hours(pair) {
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);

    const candles = await Candle2m.find({
      pair: pair,
      timestamp: { $gte: twelveHoursAgo },
    })
      .select("timestamp")
      .sort({ timestamp: 1 })
      .lean();

    console.log("Fetched candles from DB:", candles);
    return candles.map((c) => c.timestamp);
  }

  async insertMissingCandles(pair, missingCandles) {
    // missingCandles array format:
    // [{ timestamp, open, close, high, low, volume }, ...]

    if (!missingCandles || missingCandles.length === 0) {
      return { inserted: 0, errors: [] };
    }

    // Add pair to each candle
    const candlesToInsert = missingCandles.map((candle) => ({
      pair: pair,
      open: candle.open,
      close: candle.close,
      high: candle.high,
      low: candle.low,
      volume: candle.volume,
      timestamp: candle.timestamp,
    }));

    try {
      const result = await Candle2m.insertMany(candlesToInsert, {
        ordered: false,
        lean: true,
      });

      return {
        inserted: result.length,
        errors: [],
      };
    } catch (error) {
      // Jodi duplicate key error ashe (E11000)
      if (error.code === 11000 && error.writeErrors) {
        const inserted = candlesToInsert.length - error.writeErrors.length;
        return {
          inserted: inserted,
          errors: error.writeErrors.map((e) => ({
            timestamp: e.err.op.timestamp,
            message: "Already exists",
          })),
        };
      }
      throw error;
    }
  }
}

module.exports = new DbOperations();
