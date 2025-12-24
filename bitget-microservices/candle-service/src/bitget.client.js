const axios = require("axios");

class BitgetClient {
  constructor() {
    this.http = axios.create({
      baseURL: "https://api.bitget.com",
      timeout: 10000,
    });
  }

  async getCandles(symbol, startTime, endTime) {
    const res = await this.http.get("/api/v2/mix/market/candles", {
      params: { productType: "usdt-futures", granularity: "1m", symbol, startTime, endTime, limit: 1000 },
    });

    return res.data?.data || [];
  }
}

module.exports = new BitgetClient();
