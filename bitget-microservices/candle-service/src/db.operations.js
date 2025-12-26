const PairModel = require("./Pair.model");
const Candle2m = require("./Candle.model");

class DbOperations {
  async getDBTimestampsLast12Hours(pair, timeStampOf12hoursBeforeCandle) {
    const candles = await Candle2m.find({
      pair: pair,
      timestamp: { $gte: timeStampOf12hoursBeforeCandle },
    })
      .select("timestamp")
      .sort({ timestamp: 1 })
      .lean();

    return candles.map((c) => c.timestamp);
  }

  async lastXCandlesForAPair(pair, limit) {
    const candles = await Candle2m.find({ pair: pair })
      .select("timestamp open close high low volume")
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    return candles;
  }

  async insertMissingCandles(pair, missingCandles) {
    // missingCandles array format:
    // [ [ timestamp, open, max price, min price, close, volume ], ...]

    if (!missingCandles || missingCandles.length === 0) {
      return { inserted: 0, errors: [] };
    }

    // Add pair to each candle
    const candlesToInsert = missingCandles.map((candle) => ({
      pair: pair,
      open: candle[1],
      close: candle[4],
      high: candle[2],
      low: candle[3],
      volume: candle[5],
      timestamp: candle[0],
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

  async getCandleListeningPairs() {
    const pairsToListen = await PairModel.find(
      {
        volume24h: { $gte: 30_000_000 }, // 30M
      },
      { exchange: 1, symbol: 1, volume24h: 1 },
    );
    return pairsToListen.map((p) => p.symbol);
  }
}

module.exports = new DbOperations();
