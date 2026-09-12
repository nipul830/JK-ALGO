from typing import Sequence
import pandas as pd
def ema_series(prices: Sequence[float], period: int) -> list[float]:
    if period <= 0: raise ValueError("EMA period must be positive")
    return pd.Series(prices,dtype="float64").ewm(span=period,adjust=False).mean().tolist()
def crossover(fast: Sequence[float], slow: Sequence[float]) -> str | None:
    if len(fast)<2 or len(slow)<2: return None
    if fast[-2] <= slow[-2] and fast[-1] > slow[-1]: return "bullish"
    if fast[-2] >= slow[-2] and fast[-1] < slow[-1]: return "bearish"
    return None
