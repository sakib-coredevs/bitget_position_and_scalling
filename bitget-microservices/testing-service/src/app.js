require("dotenv").config();
require("./redis.consumer");
const logger = require("../logger");

logger.info("This is an info message.");
logger.warn("This is a warning message");
logger.error("This is an error message");
