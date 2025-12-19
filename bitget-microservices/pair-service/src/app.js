require("dotenv").config();
const logger = require("../logger");
const connectDB = require("./db");
require("./schedular");

(async () => {
  await connectDB();
  logger.info("Started successfully");
})();
