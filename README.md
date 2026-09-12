# JK-ALGO

Minimal Delta Exchange paper-trading algo.

## V1
- Live market price feed
- EMA 9 / EMA 15 crossover signals
- Paper trading only
- Basic P&L
- AI strategy builder interface (rules only; no arbitrary code execution)

## Run
1. Copy .env.example to .env
2. Add Delta market-data credentials if required by your chosen feed.
3. Install dependencies: pip install -r requirements.txt
4. Run: python main.py

Real order execution is intentionally not implemented in V1.
