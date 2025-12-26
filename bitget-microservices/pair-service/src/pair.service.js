const logger = require("../logger");
const bitgetClient = require("./bitget.client");
const Pair = require("./Pair.model");
const redis = require("./redis");

const VOLUME_THRESHOLD_UPPER = 50_000_000; // 50M
const VOLUME_THRESHOLD_LOWER = 45_000_000; // 45M

class PairService {
  async syncBitgetPairs() {
    try {
      const pairs = await bitgetClient.fetchFuturesPairs();

      // console.log(`[PAIR-SERVICE] Fetched : `, pairs);

      const existingPairs = await Pair.find({ exchange: "BITGET" }, { symbol: 1, _id: 0 });

      // console.log("[PAIR-SERVICE] Existing pairs in DB:");
      // console.log("Existing pairs length:", existingPairs.length);
      // console.log(existingPairs);

      const existingSymbolSet = new Set(existingPairs.map((p) => p.symbol));

      const newPairs = pairs.filter((p) => !existingSymbolSet.has(p.symbol));

      // console.log("New pairs to add:");
      // console.log("New pairs length:", newPairs.length);
      // console.log(newPairs);

      if (newPairs.length === 0) {
        logger.info("[PAIR-SERVICE] No new pairs to add.");
        return;
      }

      const insertData = newPairs.map((p) => ({
        exchange: "BITGET",
        symbol: p.symbol,
        baseCoin: p.baseCoin,
        quoteCoin: p.quoteCoin,
        buyLimitPriceRatio: p.buyLimitPriceRatio,
        sellLimitPriceRatio: p.sellLimitPriceRatio,
        feeRateUpRatio: p.feeRateUpRatio,
        makerFeeRate: p.makerFeeRate,
        takerFeeRate: p.takerFeeRate,
        minTradeNum: p.minTradeNum,
        priceEndStep: p.priceEndStep,
        volumePlace: p.volumePlace,
        pricePlace: p.pricePlace,
        sizeMultiplier: p.sizeMultiplier,
        openCostUpRatio: p.openCostUpRatio,
        minTradeUSDT: p.minTradeUSDT,
        fundInterval: p.fundInterval,
        minLever: p.minLever,
        maxLever: p.maxLever,
        posLimit: p.posLimit,
        tradable: false,
        phase: "one",
        candleListening: false,
      }));

      const savedPairs = await Pair.insertMany(insertData, {
        ordered: false,
      });

      for (const pair of savedPairs) {
        await redis.publish(
          "NEW_FUTURES_PAIR",
          JSON.stringify({
            exchange: "BITGET",
            symbol: pair.symbol,
          }),
        );

        logger.info(`New pair added: ${pair.symbol}`);
      }
    } catch (error) {
      logger.error("Error syncing Bitget pairs: " + error.message);
    }
  }

  async evaluateTradablePairs() {
    try {
      //  OFF → ON
      const toEnable = await Pair.find(
        {
          volume24h: { $gte: VOLUME_THRESHOLD_UPPER },
          tradable: false,
        },
        { exchange: 1, symbol: 1, volume24h: 1 },
      );

      if (toEnable.length > 0) {
        await Pair.updateMany({ _id: { $in: toEnable.map((p) => p._id) } }, { $set: { tradable: true } });

        for (const pair of toEnable) {
          await redis.publish(
            "PAIR_TRADABLE_ON",
            JSON.stringify({
              exchange: pair.exchange,
              symbol: pair.symbol,
            }),
          );

          logger.info(`Tradable ON: ${pair.symbol}; Volume24h: ${pair.volume24h}`);
        }
      }

      //  ON → OFF
      const toDisable = await Pair.find(
        {
          volume24h: { $lt: VOLUME_THRESHOLD_LOWER },
          tradable: true,
        },
        { exchange: 1, symbol: 1, volume24h: 1 },
      );

      if (toDisable.length > 0) {
        await Pair.updateMany({ _id: { $in: toDisable.map((p) => p._id) } }, { $set: { tradable: false } });

        for (const pair of toDisable) {
          await redis.publish(
            "PAIR_TRADABLE_OFF",
            JSON.stringify({
              exchange: pair.exchange,
              symbol: pair.symbol,
            }),
          );

          logger.info(`Tradable OFF: ${pair.symbol}; Volume24h: ${pair.volume24h}`);
        }
      }

      logger.info("[PAIR-SERVICE] Tradable status evaluated");
    } catch (error) {
      logger.error("Error evaluating tradable pairs: " + error.message);
    }
  }

  async syncFuturesPairVolume24h() {
    try {
      const tickers = await bitgetClient.fetchFuturesPairVolume24h();
      const operations = tickers.map((item) => ({
        updateOne: {
          filter: { symbol: item.symbol, exchange: "BITGET" },
          update: { $set: { volume24h: parseFloat(item.usdtVolume) } },
          upsert: false,
        },
      }));

      if (operations.length > 0) {
        const result = await Pair.bulkWrite(operations);
        logger.info(`Volume updated for: ${result.modifiedCount} pairs.`);
      }
    } catch (error) {
      logger.error("Error updating futures pair volume24h: " + error.message);
    }
  }

  async evaluateCandleListeningPairs() {
    try {
      const pairsToListen = await Pair.find(
        {
          candleListening: false,
          volume24h: { $gte: 30_000_000 }, // 30M
        },
        { exchange: 1, symbol: 1, volume24h: 1 },
      );

      if (pairsToListen.length > 0) {
        await Pair.updateMany({ _id: { $in: pairsToListen.map((p) => p._id) } }, { $set: { candleListening: true } });

        // for (const pair of pairsToListen) {
        //   await redis.publish(
        //     "PAIR_CANDLE_LISTENING_ON",
        //     JSON.stringify({
        //       exchange: pair.exchange,
        //       symbol: pair.symbol,
        //     }),
        //   );

        //   logger.info(`Candle Listening ON: ${pair.symbol}; Volume24h: ${pair.volume24h}`);
        // }
      }

      const pairsToStopListening = await Pair.find(
        {
          candleListening: true,
          volume24h: { $lt: 25_000_000 }, // 25M
        },
        { exchange: 1, symbol: 1, volume24h: 1 },
      );

      if (pairsToStopListening.length > 0) {
        await Pair.updateMany(
          { _id: { $in: pairsToStopListening.map((p) => p._id) } },
          { $set: { candleListening: false } },
        );

        // for (const pair of pairsToStopListening) {
        //   await redis.publish(
        //     "PAIR_CANDLE_LISTENING_OFF",
        //     JSON.stringify({
        //       exchange: pair.exchange,
        //       symbol: pair.symbol,
        //     }),
        //   );

        //   logger.info(`Candle Listening OFF: ${pair.symbol}; Volume24h: ${pair.volume24h}`);
        // }
      }

      logger.info("[PAIR-SERVICE] Candle Listening status evaluated");
    } catch (error) {
      logger.error("Error evaluating candle listening pairs: " + error.message);
    }
  }
}

module.exports = new PairService();
