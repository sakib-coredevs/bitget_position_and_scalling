const axios = require("axios");

class BitgetClient {
  constructor() {
    this.http = axios.create({
      baseURL: "https://api.bitget.com",
      timeout: 10000,
    });
  }

  async fetchFuturesPairs() {
    const res = await this.http.get("/api/v2/mix/market/contracts", { params: { productType: "USDT-FUTURES" } });

    return res.data?.data || [];
  }

  async fetchFuturesPairVolume24h(symbol) {
    const res = await this.http.get("/api/v2/mix/market/tickers", { params: { productType: "USDT-FUTURES", symbol } });

    const tickers = res.data?.data || [];

    return tickers;
  }
}

module.exports = new BitgetClient();
