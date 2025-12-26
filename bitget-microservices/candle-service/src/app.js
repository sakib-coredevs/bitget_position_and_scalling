require("dotenv").config();
const logger = require("../logger");
const connectDB = require("./db");
const dbOperations = require("./db.operations");
const Test = require("./Test");
// require("./schedular");

(async () => {
  await connectDB();
  logger.info("Started successfully");
  await Test.testCandles();
})();
