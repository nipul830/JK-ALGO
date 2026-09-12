from dataclasses import dataclass
from typing import Optional

@dataclass
class Signal:
    action: str
    price: float

class EMA9x15:
    def __init__(self):
        self.prev_ema9: Optional[float] = None
        self.prev_ema15: Optional[float] = None

    @staticmethod
    def ema(prev: Optional[float], price: float, period: int) -> float:
        if prev is None:
            return price
        k = 2 / (period + 1)
        return price * k + prev * (1 - k)

    def update(self, price: float) -> Optional[Signal]:
        ema9 = self.ema(self.prev_ema9, price, 9)
        ema15 = self.ema(self.prev_ema15, price, 15)
        signal = None
        if self.prev_ema9 is not None and self.prev_ema15 is not None:
            if self.prev_ema9 <= self.prev_ema15 and ema9 > ema15:
                signal = Signal("LONG", price)
            elif self.prev_ema9 >= self.prev_ema15 and ema9 < ema15:
                signal = Signal("SHORT", price)
        self.prev_ema9, self.prev_ema15 = ema9, ema15
        return signal
