import os
import time
from dotenv import load_dotenv
from strategy import EMA9x15
from paper_trader import PaperTrader

load_dotenv()

def run_demo():
    strategy = EMA9x15()
    trader = PaperTrader(float(os.getenv("STARTING_BALANCE", "1000")))
    # Demo prices make the paper engine testable without placing any orders.
    prices = [100, 99, 98, 99, 101, 103, 102, 100, 98, 97, 99, 102]
    for price in prices:
        signal = strategy.update(price)
        if signal:
            trader.on_signal(signal.action, signal.price)
            print(f"{signal.action} @ {signal.price:.2f}")
        print(f"price={price:.2f} unrealized={trader.unrealized_pnl(price):.2f} realized={trader.realized_pnl:.2f}")
    if trader.position:
        trader.close(prices[-1])
    print(f"final_balance={trader.balance:.2f}")

if __name__ == "__main__":
    run_demo()
