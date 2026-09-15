import "dotenv/config";
import express from "express";
import cors from "cors";
import crypto from "node:crypto";

const app = express();
app.use(cors());
app.use(express.json({ limit: "64kb" }));

const PORT = Number(process.env.PORT || 8787);

function deltaBase(environment = "testnet") {
  return environment === "live"
    ? (process.env.DELTA_BASE_URL || "https://api.india.delta.exchange")
    : (process.env.DELTA_TESTNET_BASE_URL || "https://cdn-ind.testnet.deltaex.org");
}

function buildQuery(query = {}) {
  const entries = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([a], [b]) => a.localeCompare(b));
  return new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
}

// Delta v2 signing: method + timestamp + request path + query string + body.
function signDelta(method, path, queryString, timestamp, body, secret) {
  const payload =
    method.toUpperCase() +
    String(timestamp) +
    path +
    (queryString ? `?${queryString}` : "") +
    (body || "");
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function credentials(body) {
  const key = String(body?.apiKey || "").trim();
  const secret = String(body?.apiSecret || "").trim();
  if (!key || !secret) throw new Error("Delta API Key and API Secret are required");
  return { key, secret };
}

async function deltaRequest({ method = "GET", path, query = {}, body, apiKey, apiSecret, environment }) {
  const base = deltaBase(environment);
  const queryString = buildQuery(query);
  const bodyText = body === undefined ? "" : JSON.stringify(body);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signDelta(method, path, queryString, timestamp, bodyText, apiSecret);
  const url = base + path + (queryString ? `?${queryString}` : "");

  const response = await fetch(url, {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "api-key": apiKey,
      timestamp: String(timestamp),
      signature,
      "User-Agent": "JK-Algo-Hub/1.0"
    },
    body: method === "GET" || method === "DELETE" ? undefined : bodyText
  });

  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 2000) }; }
  return { response, data };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "JK Algo Hub Backend", version: "phase1" });
});

// Public market-data proxy. Credentials are not required.
app.get("/api/market/products", async (req, res) => {
  try {
    const environment = req.query.environment === "live" ? "live" : "testnet";
    const { response, data } = await fetch(
      deltaBase(environment) + "/v2/products?" + buildQuery({
        page_size: req.query.page_size || 100,
        states: req.query.states || "live"
      }),
      { headers: { Accept: "application/json", "User-Agent": "JK-Algo-Hub/1.0" } }
    ).then(async r => {
      const text = await r.text();
      let parsed; try { parsed = JSON.parse(text); } catch { parsed = { raw: text.slice(0, 2000) }; }
      return { response: r, data: parsed };
    });
    res.status(response.ok ? 200 : 502).json(data);
  } catch (e) {
    res.status(502).json({ success: false, error: e.message });
  }
});


// Public ticker proxy for live market-price polling.
app.get("/api/market/ticker", async (req, res) => {
  try {
    const environment = req.query.environment === "live" ? "live" : "testnet";
    const symbol = String(req.query.symbol || "").trim();
    if (!symbol) return res.status(400).json({ ok:false, error:"symbol is required" });
    const url = deltaBase(environment) + "/v2/tickers/" + encodeURIComponent(symbol);
    const upstream = await fetch(url, { headers:{ Accept:"application/json", "User-Agent":"JK-Algo-Hub/1.0" } });
    const text = await upstream.text();
    let data; try { data = JSON.parse(text); } catch { data = { raw:text.slice(0,2000) }; }
    res.status(upstream.ok ? 200 : 502).json(data);
  } catch (e) {
    res.status(502).json({ ok:false, error:e.message });
  }
});


// Historical OHLC candle proxy. Public endpoint; no credentials required.
app.get("/api/market/candles", async (req, res) => {
  try {
    const environment = req.query.environment === "live" ? "live" : "testnet";
    const symbol = String(req.query.symbol || "").trim();
    const resolution = String(req.query.resolution || "5m").trim();
    const end = Number(req.query.end || Math.floor(Date.now() / 1000));
    const start = Number(req.query.start || end - 86400);
    if (!symbol) return res.status(400).json({ ok:false, error:"symbol is required" });
    const qs = buildQuery({ resolution, symbol, start, end });
    const upstream = await fetch(deltaBase(environment) + "/v2/history/candles?" + qs, {
      headers:{ Accept:"application/json", "User-Agent":"JK-Algo-Hub/1.0" }
    });
    const text = await upstream.text();
    let data; try { data = JSON.parse(text); } catch { data = { raw:text.slice(0,2000) }; }
    res.status(upstream.ok ? 200 : 502).json(data);
  } catch (e) {
    res.status(502).json({ ok:false, error:e.message });
  }
});

// Verify API credentials against an authenticated read endpoint.
// This does NOT place, modify or cancel an order.
app.post("/api/delta/test", async (req, res) => {
  try {
    const { key, secret } = credentials(req.body);
    const environment = req.body.environment === "live" ? "live" : "testnet";
    const { response, data } = await deltaRequest({
      method: "GET",
      path: "/v2/positions/margined",
      apiKey: key,
      apiSecret: secret,
      environment
    });
    res.status(response.ok ? 200 : 502).json({
      ok: response.ok,
      status: response.status,
      environment,
      message: response.ok ? "Authenticated successfully" : "Delta rejected the credentials",
      data
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// Read current positions without exposing the API secret to the client.
app.post("/api/delta/positions", async (req, res) => {
  try {
    const { key, secret } = credentials(req.body);
    const environment = req.body.environment === "live" ? "live" : "testnet";
    const query = req.body.productId ? { product_id: req.body.productId } : {};
    const { response, data } = await deltaRequest({
      method: "GET",
      path: "/v2/positions",
      query,
      apiKey: key,
      apiSecret: secret,
      environment
    });
    res.status(response.ok ? 200 : 502).json(data);
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`JK Algo Hub backend listening on ${PORT}`));
}

export default app;
