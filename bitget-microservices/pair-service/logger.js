const { createLogger, format, transports } = require("winston");
const fs = require("fs");
const path = require("path");

const MAX_LOGFILES_EACH_FOLDER = 10;

function buildLogger(serviceName, logsRoot) {
  try {
    if (!fs.existsSync(logsRoot)) {
      fs.mkdirSync(logsRoot, { recursive: true });
    }

    const serviceLogDir = path.join(logsRoot, serviceName);
    if (!fs.existsSync(serviceLogDir)) {
      fs.mkdirSync(serviceLogDir, { recursive: true });
    }

    const now = new Date();
    const timestamp = now
      .toLocaleString("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
      .replace(/[,\s]/g, "-")
      .replace(/:/g, "-");

    const logFile = path.join(serviceLogDir, `${timestamp}.log`);

    try {
      const files = fs
        .readdirSync(serviceLogDir)
        .filter((f) => f.endsWith(".log"))
        .map((f) => {
          const filePath = path.join(serviceLogDir, f);
          try {
            return {
              name: f,
              time: fs.statSync(filePath).mtime.getTime(),
            };
          } catch {
            return null;
          }
        })
        .filter(Boolean)
        .sort((a, b) => a.time - b.time);

      if (files.length >= MAX_LOGFILES_EACH_FOLDER) {
        const filesToDelete = files.slice(0, files.length - MAX_LOGFILES_EACH_FOLDER + 1);
        for (const file of filesToDelete) {
          try {
            fs.unlinkSync(path.join(serviceLogDir, file.name));
          } catch (err) {
            console.warn(`Could not delete log file ${file.name}:`, err.message);
          }
        }
      }
    } catch (err) {
      console.warn("Log rotation failed:", err.message);
    }

    const logger = createLogger({
      level: process.env.LOG_LEVEL || "info",
      format: format.combine(
        format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        format.errors({ stack: true }),
        format.printf(({ timestamp, level, message, stack }) => {
          const msg = `${timestamp} [${serviceName}] ${level.toUpperCase()}: ${message}`;
          return stack ? `${msg}\n${stack}` : msg;
        }),
      ),
      transports: [
        new transports.File({
          filename: logFile,
          maxsize: 10485760, // 10MB
        }),
      ],
    });

    if (process.env.NODE_ENV !== "production") {
      logger.add(
        new transports.Console({
          format: format.combine(format.colorize(), format.simple()),
        }),
      );
    }

    return logger;
  } catch (err) {
    console.error("Failed to initialize file logger:", err);
    return createLogger({
      level: "info",
      transports: [new transports.Console()],
    });
  }
}

module.exports = buildLogger("Pair-Service", path.join(__dirname, "logs"));
