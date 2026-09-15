import crypto from "node:crypto";

function base(environment) {
  return environment === "live"
    ? (process.env.DELTA_BASE_URL || "https://api.india.delta.exchange")
    : (process.env.DELTA_TESTNET_BASE_URL || "https://cdn-ind.testnet.deltaex.org");
}

function sign(method, path, timestamp, body, secret) {
  const payload = String(timestamp) + method.toUpperCase() + path + (body || "");
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"Method not allowed" });
  try {
    const { apiKey="", apiSecret="", environment="testnet" } = req.body || {};
    if (!apiKey.trim() || !apiSecret.trim()) {
      return res.status(400).json({ ok:false, error:"Delta API Key and API Secret are required" });
    }
    const env = environment === "live" ? "live" : "testnet";
    const path = "/v2/time";
    const timestamp = Math.floor(Date.now()/1000);
    const upstream = await fetch(base(env)+path, {
      headers: {
        "api-key": apiKey.trim(),
        "timestamp": String(timestamp),
        "signature": sign("GET", path, timestamp, "", apiSecret.trim()),
        "User-Agent": "JK-Algo-Hub"
      }
    });
    const response = await upstream.text();
    return res.status(upstream.ok ? 200 : 502).json({
      ok: upstream.ok, status: upstream.status, environment: env,
      response: response.slice(0,1000)
    });
  } catch (e) {
    return res.status(500).json({ ok:false, error:"Broker connection failed" });
  }
}
