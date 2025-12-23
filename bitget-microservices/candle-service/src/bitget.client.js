const axios = require("axios");

class BitgetClient {
  constructor() {
    this.http = axios.create({
      baseURL: "https://api.bitget.com",
      timeout: 10000,
    });
  }

  async fetchFuturesPairs(symbol, limit) {
    const res = await this.http.get("/api/v2/mix/market/candles", {
      params: { productType: "usdt-futures", granularity: "1m", symbol, limit },
    });

    return res.data?.data || [];
  }
}

module.exports = new BitgetClient();
