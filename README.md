# JK ALGO — Live Market + Paper Trading

Live Delta Exchange public market data with an EMA crossover strategy and a local paper-trading engine. No private API keys and no real order placement are included.

Run: python -m venv .venv
Then install: pip install -r requirements.txt
Copy .env.example to .env and run: python main.py

The app loads historical candles first, then connects to Delta's public WebSocket candlestick feed with automatic reconnect. Paper balance, position and trades are persisted to paper_state.json and logs to trades.log.

Default strategy: EMA 9/26 crossover, 0.5% risk per trade, 1% stop loss, 1% take profit, one open paper position at a time.

Market data is live; execution is always simulated locally in this repository.
