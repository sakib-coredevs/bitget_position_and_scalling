// BitgetTrader.js - Real Paper Trading on Bitget Demo Account
const crypto = require("crypto");
const axios = require("axios");
const WebSocket = require("ws");
const Bottleneck = require("bottleneck");
const { Order, Trade, Position, Insight, Account } = require("./models");
const logger = require("../logger");

class BitgetTrader {
  constructor(config) {
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.passphrase = config.passphrase;
    this.paperTrade = config.paperTrade || false;

    // Paper trade = Demo/Testnet API, Real trade = Production API
    this.baseURL = this.paperTrade
      ? "https://api.bitget.com" // Demo trading still uses same URL with demo credentials
      : "https://api.bitget.com";

    this.wsURL = this.paperTrade ? "wss://ws.bitget.com/v2/ws/private" : "wss://ws.bitget.com/v2/ws/private";

    // Rate limiter: 20 requests per second
    this.limiter = new Bottleneck({
      reservoir: 20,
      reservoirRefreshAmount: 20,
      reservoirRefreshInterval: 1000,
      maxConcurrent: 5,
    });

    this.ws = null;
    this.positions = new Map();
    this.accountBalance = 0;
    this.last24hVolume = new Map();

    logger.info(`Trader initialized - Mode: ${this.paperTrade ? "PAPER (Demo Account)" : "REAL"}`);
  }

  // Generate signature for authentication
  generateSignature(timestamp, method, requestPath, body = "") {
    const message = timestamp + method + requestPath + body;
    return crypto.createHmac("sha256", this.apiSecret).update(message).digest("base64");
  }

  // Make authenticated API request
  async apiRequest(method, endpoint, data = null) {
    return this.limiter.schedule(async () => {
      const timestamp = Date.now().toString();
      const requestPath = endpoint;
      const body = data ? JSON.stringify(data) : "";

      const signature = this.generateSignature(timestamp, method.toUpperCase(), requestPath, body);

      try {
        const response = await axios({
          method,
          url: `${this.baseURL}${endpoint}`,
          headers: {
            "ACCESS-KEY": this.apiKey,
            "ACCESS-SIGN": signature,
            "ACCESS-TIMESTAMP": timestamp,
            "ACCESS-PASSPHRASE": this.passphrase,
            "Content-Type": "application/json",
            locale: "en-US",
          },
          data: data,
        });

        return response.data;
      } catch (error) {
        logger.error("API Request Error:", {
          endpoint,
          error: error.response?.data || error.message,
        });
        throw error;
      }
    });
  }

  // Get 24h trading volume for a symbol
  async get24hVolume(symbol) {
    try {
      const response = await this.apiRequest(
        "GET",
        `/api/v2/mix/market/ticker?symbol=${symbol}&productType=USDT-FUTURES`,
      );

      const volume = parseFloat(response.data[0]?.baseVolume || 0);
      this.last24hVolume.set(symbol, volume);

      logger.info(`24h Volume for ${symbol}: ${volume}`);
      return volume;
    } catch (error) {
      logger.error("Get 24h volume error:", error.message);
      return 0;
    }
  }

  // Calculate order size based on 24h volume and available balance
  async calculateOrderSize(symbol, price) {
    try {
      // Get 24h volume
      const volume24h = await this.get24hVolume(symbol);

      // Calculate required size: volume * 0.009 / 40
      const requiredSize = (volume24h * 0.009) / 40;

      // Get available balance
      const balance = await this.getAvailableBalance("USDT");

      // Calculate maximum affordable size
      const maxAffordableSize = balance / price;

      // Use minimum of required and affordable
      let orderSize = Math.min(requiredSize, maxAffordableSize);

      // Round to appropriate decimal places (usually 3 for BTC, 2 for ETH)
      orderSize = parseFloat(orderSize.toFixed(3));

      logger.info(`Order Size Calculation for ${symbol}:`, {
        volume24h,
        requiredSize,
        availableBalance: balance,
        maxAffordableSize,
        finalOrderSize: orderSize,
      });

      // Store for later increase when balance grows
      await this.saveOrderSizeData(symbol, {
        requiredSize,
        currentSize: orderSize,
        availableBalance: balance,
      });

      return orderSize;
    } catch (error) {
      logger.error("Calculate order size error:", error.message);
      return 0;
    }
  }

  // Get available balance for a coin
  async getAvailableBalance(coin = "USDT") {
    try {
      const response = await this.apiRequest("GET", `/api/v2/mix/account/accounts?productType=USDT-FUTURES`);

      const account = response.data.find((acc) => acc.marginCoin === coin);
      const available = parseFloat(account?.available || 0);

      this.accountBalance = available;

      // Save to database
      await Account.findOneAndUpdate(
        { coin },
        {
          coin,
          available,
          equity: parseFloat(account?.equity || 0),
          frozen: parseFloat(account?.frozen || 0),
          unrealizedPnl: parseFloat(account?.unrealizedPL || 0),
          timestamp: new Date(),
        },
        { upsert: true, new: true },
      );

      return available;
    } catch (error) {
      logger.error("Get available balance error:", error.message);
      return 0;
    }
  }

  // Save order size data for future adjustment
  async saveOrderSizeData(symbol, data) {
    try {
      await Insight.create({
        type: "order_size_data",
        symbol,
        metadata: data,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error("Save order size data error:", error.message);
    }
  }

  // Check and increase position sizes when balance grows
  async checkAndIncreasePositions() {
    try {
      const positions = await Position.find({ size: { $gt: 0 } });

      for (const position of positions) {
        // Get latest order size data
        const sizeData = await Insight.findOne({
          type: "order_size_data",
          symbol: position.symbol,
        }).sort({ timestamp: -1 });

        if (!sizeData) continue;

        const { requiredSize, currentSize } = sizeData.metadata;

        // If current size is less than required
        if (currentSize < requiredSize) {
          const currentBalance = await this.getAvailableBalance("USDT");
          const price = await this.getMarketPrice(position.symbol);
          const maxAffordableSize = currentBalance / price;

          // Calculate additional size we can add
          const additionalSize = Math.min(requiredSize - currentSize, maxAffordableSize);

          if (additionalSize > 0.001) {
            // Minimum increase threshold
            logger.info(`Increasing position size for ${position.symbol}:`, {
              currentSize,
              requiredSize,
              additionalSize,
            });

            // Place additional order
            await this.placeOrder({
              symbol: position.symbol,
              side: position.side === "long" ? "buy" : "sell",
              orderType: "market",
              size: parseFloat(additionalSize.toFixed(3)),
              marginMode: position.marginMode,
              leverage: position.leverage,
              isIncreaseOrder: true,
            });
          }
        }
      }
    } catch (error) {
      logger.error("Check and increase positions error:", error.message);
    }
  }

  // Set leverage
  async setLeverage(symbol, marginMode, leverage) {
    try {
      await this.apiRequest("POST", "/api/v2/mix/account/set-leverage", {
        symbol,
        productType: "USDT-FUTURES",
        marginMode,
        leverage: leverage.toString(),
      });

      logger.info(`Leverage set: ${symbol} - ${leverage}x (${marginMode})`);
    } catch (error) {
      logger.warn("Set leverage warning:", error.message);
    }
  }

  // Place Order with Stop Loss
  async placeOrder(params) {
    const {
      symbol,
      side,
      orderType = "market",
      size,
      price,
      marginMode = "isolated",
      leverage = 10,
      stopLossPercent = 2, // Default 2% stop loss
      isIncreaseOrder = false,
    } = params;

    try {
      // Set leverage first
      await this.setLeverage(symbol, marginMode, leverage);

      // Calculate order size if not provided
      let orderSize = size;
      if (!isIncreaseOrder) {
        const marketPrice = price || (await this.getMarketPrice(symbol));
        orderSize = await this.calculateOrderSize(symbol, marketPrice);

        if (orderSize <= 0) {
          logger.warn("Insufficient balance or volume for order");
          return null;
        }
      }

      // Main order data
      const orderData = {
        symbol: symbol,
        productType: "USDT-FUTURES",
        marginMode: marginMode,
        marginCoin: "USDT",
        side: side.toLowerCase(),
        orderType: orderType.toLowerCase(),
        size: orderSize.toString(),
        tradeSide: "open",
      };

      if (orderType === "limit" && price) {
        orderData.price = price.toString();
      }

      // Place main order
      const response = await this.apiRequest("POST", "/api/v2/mix/order/place-order", orderData);

      const orderId = response.data.orderId;
      const executionPrice = price || (await this.getMarketPrice(symbol));

      // Save to database
      const order = new Order({
        orderId: orderId,
        symbol,
        side,
        orderType,
        size: orderSize,
        price: executionPrice,
        status: "pending",
        paperTrade: this.paperTrade,
        timestamp: new Date(),
      });
      await order.save();

      logger.info("Order placed:", {
        orderId: orderId,
        symbol,
        side,
        size: orderSize,
        type: this.paperTrade ? "PAPER (Demo)" : "REAL",
      });

      // Place Stop Loss order
      await this.placeStopLoss({
        symbol,
        side: side === "buy" ? "sell" : "buy", // Opposite side
        size: orderSize,
        entryPrice: executionPrice,
        stopLossPercent,
        marginMode,
      });

      // Log insight
      await this.logInsight({
        type: "order_placed",
        symbol,
        side,
        size: orderSize,
        price: executionPrice,
        message: `Order placed ${isIncreaseOrder ? "(Position Increase)" : "(New Position)"}`,
        metadata: { leverage, marginMode, stopLossPercent },
      });

      return order;
    } catch (error) {
      logger.error("Place order error:", error.message);
      throw error;
    }
  }

  // Place Stop Loss Order
  async placeStopLoss(params) {
    const { symbol, side, size, entryPrice, stopLossPercent, marginMode } = params;

    try {
      // Calculate stop loss price
      const stopLossPrice =
        side === "buy"
          ? entryPrice * (1 + stopLossPercent / 100) // If closing long, SL above entry
          : entryPrice * (1 - stopLossPercent / 100); // If closing short, SL below entry

      const stopLossData = {
        symbol: symbol,
        productType: "USDT-FUTURES",
        marginMode: marginMode,
        marginCoin: "USDT",
        planType: "loss_plan",
        triggerPrice: stopLossPrice.toFixed(2),
        triggerType: "mark_price",
        side: side.toLowerCase(),
        orderType: "market",
        size: size.toString(),
        tradeSide: "close",
      };

      const response = await this.apiRequest("POST", "/api/v2/mix/order/place-plan-order", stopLossData);

      logger.info("Stop Loss set:", {
        symbol,
        stopLossPrice: stopLossPrice.toFixed(2),
        orderId: response.data.orderId,
      });

      // Save stop loss info
      await this.logInsight({
        type: "stop_loss_set",
        symbol,
        price: stopLossPrice,
        message: `Stop loss set at ${stopLossPrice.toFixed(2)} (${stopLossPercent}%)`,
        metadata: { entryPrice, stopLossPercent },
      });

      return response.data.orderId;
    } catch (error) {
      logger.error("Place stop loss error:", error.message);
      throw error;
    }
  }

  // Get Market Price
  async getMarketPrice(symbol) {
    try {
      const response = await this.apiRequest(
        "GET",
        `/api/v2/mix/market/ticker?symbol=${symbol}&productType=USDT-FUTURES`,
      );
      return parseFloat(response.data[0].lastPr);
    } catch (error) {
      logger.error("Get market price error:", error.message);
      return 0;
    }
  }

  // Connect to Private WebSocket
  async connectWebSocket() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsURL);

      this.ws.on("open", () => {
        logger.info("WebSocket connected");
        this.authenticateWS();
        this.subscribeToChannels();

        // Start position size checker (every 5 minutes)
        setInterval(() => this.checkAndIncreasePositions(), 5 * 60 * 1000);

        resolve();
      });

      this.ws.on("message", (data) => {
        this.handleWSMessage(JSON.parse(data.toString()));
      });

      this.ws.on("error", (error) => {
        logger.error("WebSocket error:", error);
        reject(error);
      });

      this.ws.on("close", () => {
        logger.warn("WebSocket disconnected. Reconnecting...");
        setTimeout(() => this.connectWebSocket(), 5000);
      });

      // Heartbeat
      setInterval(() => {
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.send("ping");
        }
      }, 30000);
    });
  }

  // Authenticate WebSocket
  authenticateWS() {
    const timestamp = Date.now().toString();
    const sign = this.generateSignature(timestamp, "GET", "/user/verify", "");

    const authMsg = {
      op: "login",
      args: [
        {
          apiKey: this.apiKey,
          passphrase: this.passphrase,
          timestamp,
          sign,
        },
      ],
    };

    this.ws.send(JSON.stringify(authMsg));
  }

  // Subscribe to channels
  subscribeToChannels() {
    setTimeout(() => {
      const subscribeMsg = {
        op: "subscribe",
        args: [
          { channel: "orders", instType: "USDT-FUTURES" },
          { channel: "positions", instType: "USDT-FUTURES" },
          { channel: "account", instType: "USDT-FUTURES" },
        ],
      };
      this.ws.send(JSON.stringify(subscribeMsg));
      logger.info("Subscribed to WebSocket channels");
    }, 2000);
  }

  // Handle WebSocket messages
  async handleWSMessage(msg) {
    if (msg.event === "login") {
      logger.info("WebSocket authenticated");
      return;
    }

    if (msg.event === "subscribe") {
      logger.info(`Subscribed to: ${msg.arg?.channel}`);
      return;
    }

    if (msg.action === "snapshot" || msg.action === "update") {
      const channel = msg.arg?.channel;

      if (channel === "orders") {
        await this.handleOrderUpdate(msg.data);
      } else if (channel === "positions") {
        await this.handlePositionUpdate(msg.data);
      } else if (channel === "account") {
        await this.handleAccountUpdate(msg.data);
      }
    }
  }

  // Handle order updates
  async handleOrderUpdate(orders) {
    for (const orderData of orders) {
      try {
        const updatedOrder = await Order.findOneAndUpdate(
          { orderId: orderData.ordId },
          {
            status: orderData.status,
            filledSize: parseFloat(orderData.accFillSz || 0),
            avgPrice: parseFloat(orderData.priceAvg || 0),
            updatedAt: new Date(),
          },
          { upsert: true, new: true },
        );

        logger.info("Order updated:", {
          orderId: orderData.ordId,
          status: orderData.status,
          symbol: orderData.instId,
        });

        // Log trade if filled
        if (orderData.status === "filled" && orderData.accFillSz > 0) {
          const fee = parseFloat(orderData.fee || 0);
          const fillPrice = parseFloat(orderData.priceAvg);
          const fillSize = parseFloat(orderData.accFillSz);

          const trade = new Trade({
            tradeId: `${orderData.ordId}_${Date.now()}`,
            orderId: orderData.ordId,
            symbol: orderData.instId,
            side: orderData.side,
            size: fillSize,
            price: fillPrice,
            fee: Math.abs(fee),
            paperTrade: this.paperTrade,
            timestamp: new Date(),
          });
          await trade.save();

          await this.logInsight({
            type: "trade_executed",
            symbol: orderData.instId,
            side: orderData.side,
            size: fillSize,
            price: fillPrice,
            message: `Trade executed on ${this.paperTrade ? "Demo" : "Real"} account`,
            metadata: { fee: Math.abs(fee) },
          });

          logger.info("Trade executed:", {
            symbol: orderData.instId,
            side: orderData.side,
            size: fillSize,
            price: fillPrice,
            fee: Math.abs(fee),
          });
        }
      } catch (error) {
        logger.error("Handle order update error:", error.message);
      }
    }
  }

  // Handle position updates
  async handlePositionUpdate(positions) {
    for (const pos of positions) {
      try {
        const position = await Position.findOneAndUpdate(
          { symbol: pos.instId },
          {
            side: pos.holdSide,
            size: parseFloat(pos.total || 0),
            avgPrice: parseFloat(pos.averageOpenPrice || 0),
            unrealizedPnl: parseFloat(pos.unrealizedPL || 0),
            leverage: parseInt(pos.leverage || 1),
            marginMode: pos.marginMode,
            liquidationPrice: parseFloat(pos.liquidationPrice || 0),
            updatedAt: new Date(),
          },
          { upsert: true, new: true },
        );

        this.positions.set(pos.instId, position);

        logger.info("Position updated:", {
          symbol: pos.instId,
          side: pos.holdSide,
          size: pos.total,
          pnl: pos.unrealizedPL,
        });
      } catch (error) {
        logger.error("Handle position update error:", error.message);
      }
    }
  }

  // Handle account updates
  async handleAccountUpdate(accounts) {
    for (const acc of accounts) {
      const available = parseFloat(acc.available || 0);
      const equity = parseFloat(acc.equity || 0);

      this.accountBalance = available;

      logger.info("Account update:", {
        coin: acc.marginCoin,
        available,
        equity,
      });

      await this.logInsight({
        type: "account_update",
        coin: acc.marginCoin,
        available,
        equity,
        message: "Account balance updated",
      });
    }
  }

  // Log insights
  async logInsight(data) {
    try {
      const insight = new Insight({
        ...data,
        timestamp: new Date(),
      });
      await insight.save();
    } catch (error) {
      logger.error("Log insight error:", error.message);
    }
  }

  // Disconnect
  async disconnect() {
    if (this.ws) {
      this.ws.close();
      logger.info("WebSocket disconnected");
    }
  }
}

module.exports = BitgetTrader;
