import logging
from indicators import ema_series,crossover
class EMAStrategy:
    def __init__(self,fast,slow,risk,broker):
        self.fast=fast; self.slow=slow; self.risk=risk; self.broker=broker; self.log=logging.getLogger("strategy"); self.closes=[]; self.last_candle=None
    def on_candle(self,candle):
        self.broker.check_exits(candle.close)
        if self.last_candle==candle.timestamp:return
        self.last_candle=candle.timestamp; self.closes.append(candle.close); self.closes=self.closes[-500:]
        if len(self.closes)<self.slow+2 or self.broker.position:return
        signal=crossover(ema_series(self.closes,self.fast),ema_series(self.closes,self.slow))
        if not signal:return
        side="buy" if signal=="bullish" else "sell"; qty=self.risk.quantity(candle.close); sl,tp=self.risk.levels(candle.close,side)
        if self.broker.open(side,qty,candle.close,sl,tp): self.log.info("%s signal -> PAPER %s %.8f @ %.2f | SL %.2f TP %.2f",signal.upper(),side.upper(),qty,candle.close,sl,tp)
