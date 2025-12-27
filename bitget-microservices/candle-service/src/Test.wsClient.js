require("dotenv").config();
const dbOperations = require("./db.operations");
const CandleStickClientManager = require("./manager");
const connectDB = require("./db");

class WsClientTesting {
  async start() {
    const candlemangr = new CandleStickClientManager();
    await connectDB();
    await candlemangr.start();
    this.candlemangr = candlemangr;
    console.log("Testing started!");
    await this.testRunner();
  }
  async testRunner() {
    const pairs = await this.getCandleListeningPairs();
    console.log(`Pairs : ${pairs.join(", ")}`);

    await this.sub("PIPPINUSDT");
    // for (let i = 0; i < 7; i++) {
    //   await this.sub(pairs[i]);
    //   await this.wait(10);
    // }

    // const lst = [7, 6, 3, 5];
    // for (const itm of lst) {
    //   await this.unsub(pairs[itm]);
    //   await this.wait(10);
    // }

    // const lst1 = [0, 1, 2, 4];
    // for (const itm of lst1) {
    //   await this.unsub(pairs[itm]);
    //   await this.wait(10);
    // }
  }

  async wait(secs) {
    await new Promise((res) => setTimeout(res, secs * 1000));
  }
  async sub(pair) {
    console.log(`${pair} is going to subscribed!`);
    await this.candlemangr.subscribe(pair);
  }

  async unsub(pair) {
    console.log(`${pair} is going to unsubscribed!`);
    await this.candlemangr.unsubscribe(pair);
  }

  async getCandleListeningPairs() {
    const pairs = await dbOperations.getCandleListeningPairs();
    return pairs;
  }
}

(async () => {
  const tester = new WsClientTesting();
  await tester.start();
})();
