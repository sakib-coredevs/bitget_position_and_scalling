const bitgetClient = require("./bitget.client");

class CandleService {
  constructor(bitgetClient) {
    this.bitgetClient = bitgetClient;
  }

  async getFuturesCandles(symbol, limit) {
    return this.bitgetClient.fetchFuturesPairs(symbol, limit);
  }

  async fetchDBCandles(symbol) {
    // Fetch candles from the database for the given symbol over the last 12 hours ( data may be incomplete)
  }

  async validateCandles(symbol) {
    // Take a look if the last 12 hours '2m' candles are complete for the given symbol
  }

  async backfillCandles(symbol) {
    // Backfill missing '2m' candles for the given symbol over the last 12 hours
  }

  async identifyMissingCandles(candles) {
    // Identify missing candles over the last 12 hours for the 2m interval
    // Return an array of missing timestamps
  }

  async aggregateCandles(symbol, interval) {
    // Aggregate '1m' candles into the specified interval (e.g., '5m', '15m', etc.)
  }
}

module.exports = new CandleService(bitgetClient);
