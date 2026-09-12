import logging,sys
from config import Config
from market_data import DeltaPublicMarket
from paper_trading import PaperBroker
from risk_manager import RiskManager
from strategy import EMAStrategy
def main():
    c=Config(); logging.basicConfig(level=logging.INFO,format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",handlers=[logging.StreamHandler(),logging.FileHandler(c.log_file)])
    log=logging.getLogger("main"); broker=PaperBroker(c.starting_balance,c.fee_rate,c.state_file); risk=RiskManager(c.starting_balance,c.risk_per_trade,c.stop_loss_pct,c.take_profit_pct,c.max_position_pct); strategy=EMAStrategy(c.ema_fast,c.ema_slow,risk,broker); market=DeltaPublicMarket(c.symbol,c.timeframe,c.websocket_url,c.rest_url,strategy.on_candle)
    try:
        history=market.history(max(200,c.ema_slow+20))
        for candle in history[:-1]: strategy.closes.append(candle.close)
        if history: strategy.last_candle=history[-1].timestamp; strategy.on_candle(history[-1])
        log.info("LIVE MARKET + PAPER TRADING started | %s %s | balance=%.2f",c.symbol,c.timeframe,broker.balance); log.info("No real exchange orders are enabled in this build.")
        market.run_forever()
    except KeyboardInterrupt: log.info("Stopped by user")
    except Exception: log.exception("Fatal error"); sys.exit(1)
    finally: market.stop()
if __name__=="__main__": main()
