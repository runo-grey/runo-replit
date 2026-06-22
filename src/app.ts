import express, { type Express } from "express";
import cors from "cors";
const app: Express = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.get("/healthz", (_req, res) => { res.json({ status: "ok", uptime: process.uptime() }); });
app.get("/", (_req, res) => { res.json({ status: "🃏 Runo Bot is running!" }); });
export default app;
