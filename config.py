import os
from dataclasses import dataclass
from dotenv import load_dotenv
load_dotenv()
@dataclass(frozen=True)
class Config:
    symbol: str = os.getenv("SYMBOL","BTCUSD")
    timeframe: str = os.getenv("TIMEFRAME","5m")
    ema_fast: int = int(os.getenv("EMA_FAST","9"))
    ema_slow: int = int(os.getenv("EMA_SLOW","26"))
    starting_balance: float = float(os.getenv("STARTING_BALANCE","10000"))
    risk_per_trade: float = float(os.getenv("RISK_PER_TRADE","0.005"))
    stop_loss_pct: float = float(os.getenv("STOP_LOSS_PCT","0.01"))
    take_profit_pct: float = float(os.getenv("TAKE_PROFIT_PCT","0.01"))
    fee_rate: float = float(os.getenv("PAPER_FEE_RATE","0.0005"))
    max_position_pct: float = float(os.getenv("MAX_POSITION_PCT","1.0"))
    state_file: str = os.getenv("STATE_FILE","paper_state.json")
    log_file: str = os.getenv("LOG_FILE","trades.log")
    websocket_url: str = os.getenv("DELTA_PUBLIC_WS","wss://public-socket.india.delta.exchange")
    rest_url: str = os.getenv("DELTA_REST_URL","https://api.india.delta.exchange")
