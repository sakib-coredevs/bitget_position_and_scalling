const mongoose = require("mongoose");
const logger = require("../logger");

module.exports = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  logger.info("Connected to the MongoDB");
};
