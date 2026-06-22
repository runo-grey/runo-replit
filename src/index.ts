import app from "./app.js";
import { startBot } from "./bot/index.js";
const port = Number(process.env["PORT"] ?? 10000);
app.listen(port, () => { console.log(`[server] Listening on port ${port}`); });
startBot().catch((err) => { console.error("[bot] Startup error:", err); });
