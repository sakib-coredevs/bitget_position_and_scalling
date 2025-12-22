module.exports = function nowCandleTime(interval = "2m") {
  const now = new Date();
  let candleTime = new Date(now);

  switch (interval) {
    case "1m":
      candleTime.setSeconds(0, 0);
      break;
    case "2m":
      candleTime.setMinutes(Math.floor(candleTime.getMinutes() / 2) * 2, 0, 0);
      break;
    case "3m":
      candleTime.setMinutes(Math.floor(candleTime.getMinutes() / 3) * 3, 0, 0);
      break;
    case "5m":
      candleTime.setMinutes(Math.floor(candleTime.getMinutes() / 5) * 5, 0, 0);
      break;
    case "15m":
      candleTime.setMinutes(Math.floor(candleTime.getMinutes() / 15) * 15, 0, 0);
      break;
    case "30m":
      candleTime.setMinutes(Math.floor(candleTime.getMinutes() / 30) * 30, 0, 0);
      break;
    case "1h":
      candleTime.setMinutes(0, 0, 0);
      break;
    case "2h":
      candleTime.setHours(Math.floor(candleTime.getHours() / 2) * 2, 0, 0, 0);
      break;
    case "4h":
      candleTime.setHours(Math.floor(candleTime.getHours() / 4) * 4, 0, 0, 0);
      break;
    case "6h":
      candleTime.setHours(Math.floor(candleTime.getHours() / 6) * 6, 0, 0, 0);
      break;
    case "12h":
      candleTime.setHours(Math.floor(candleTime.getHours() / 12) * 12, 0, 0, 0);
      break;
    case "1d":
      candleTime.setHours(0, 0, 0, 0);
      break;
    case "1w":
      const day = candleTime.getDay(); // 0 (Sun) to 6 (Sat)
      const diffToMonday = (day + 6) % 7; // calculate days to subtract to get to Monday
      candleTime.setDate(candleTime.getDate() - diffToMonday);
      candleTime.setHours(0, 0, 0, 0);
      break;
    default:
      throw new Error(`Unsupported interval: ${interval}`);
  }

  //    return candleTime in number format (timestamp)
  //    return candleTime;
  return candleTime.getTime();
};
