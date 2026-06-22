import app from "./app.js";
import { startBot } from "./bot/index.js";

const port = process.env["PORT"] ? Number(process.env["PORT"]) : null;

if (port) {
  app.listen(port, () => {
    console.log(`[server] Listening on port ${port}`);
  });
} else {
  console.log("[server] No PORT set — running as bot-only process (Wispbyte mode)");
}

startBot().catch((err) => {
  console.error("[bot] Startup error:", err);
});
