"""
Alpaca STOCK websocket (IEX v2): live trades, NBBO quotes, and minute bars.

Note: L2 orderbooks are not available on the IEX feed. Quotes give you the
best bid/ask (NBBO). For full L2 depth you need Alpaca's SIP/Opra feed.

ENV vars:
    ALPACA_KEY      – your Alpaca API key (required)
    ALPACA_SECRET   – your Alpaca secret   (required)
    ALPACA_STOCK_WS – override the ws URL  (optional)
    SYMS            – comma-separated tickers, e.g. "AAPL,TSLA,NVDA" (optional)
    PRINT_EVERY     – throttle console output in seconds (default 1.0)
"""

import asyncio
import json
import logging
import os
import time

import dotenv
import websockets

dotenv.load_dotenv()

# ── Config ────────────────────────────────────────────────────────────────────

URL    = os.getenv("ALPACA_STOCK_WS", "wss://stream.data.alpaca.markets/v2/iex")
KEY    = os.environ["ALPACA_KEY"]
SECRET = os.environ["ALPACA_SECRET"]

# Override via env: SYMS="AAPL,TSLA,NVDA"
_raw_syms   = os.getenv("SYMS", "AAPL,TSLA")
SYMS        = [s.strip().upper() for s in _raw_syms.split(",") if s.strip()]
PRINT_EVERY = float(os.getenv("PRINT_EVERY", "1.0"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger("alpaca_stock_ws")

# ── helpers ─────────────────────────────────────────────────────────────

def fresh_state() -> dict:
    return {
        # NBBO from latest quote
        "bid_px":   None,
        "bid_sz":   None,
        "ask_px":   None,
        "ask_sz":   None,
        # last trade price / size
        "last_px":  None,
        "last_sz":  None,
        # latest closed minute bar
        "bar": None,
        # print throttle
        "last_print": 0.0,
    }

# ── Formatting ────────────────────────────────────────────────────────────────

def _fmt_spread(bid, ask) -> str:
    if bid is not None and ask is not None:
        spread = ask - bid
        mid    = (bid + ask) / 2.0
        return f"spread={spread:.4f}  mid={mid:.4f}"
    return "spread=-  mid=-"

def fmt_quote(sym: str, st: dict) -> str:
    bid_px, bid_sz = st["bid_px"], st["bid_sz"]
    ask_px, ask_sz = st["ask_px"], st["ask_sz"]
    spread_str = _fmt_spread(bid_px, ask_px)

    bid_str = f"{bid_px:.4f} x {bid_sz}" if bid_px is not None else "-"
    ask_str = f"{ask_px:.4f} x {ask_sz}" if ask_px is not None else "-"

    last_px = st["last_px"]
    last_sz = st["last_sz"]
    last_str = f"{last_px:.4f} ({last_sz} shares)" if last_px is not None else "-"

    bar = st["bar"]
    bar_str = (
        f"o={bar['o']}  h={bar['h']}  l={bar['l']}  c={bar['c']}  v={bar['v']}  t={bar['t']}"
        if bar else "-"
    )

    return (
        f"{'─'*60}\n"
        f"  {sym:>6}  last trade : {last_str}\n"
        f"         {spread_str}\n"
        f"         BID : {bid_str}\n"
        f"         ASK : {ask_str}\n"
        f"  last 1-min bar → {bar_str}\n"
        f"{'─'*60}"
    )

# ── Main ──────────────────────────────────────────────────────────────────────

async def main():
    state = {sym: fresh_state() for sym in SYMS}
    logger.info("Connecting to %s  |  symbols: %s", URL, SYMS)

    async with websockets.connect(URL, ping_interval=20, ping_timeout=10) as ws:

        # 1. Connected banner
        banner = json.loads(await ws.recv())
        logger.info("SYS %s", banner)

        # 2. Authenticate
        await ws.send(json.dumps({"action": "auth", "key": KEY, "secret": SECRET}))
        while True:
            msgs = json.loads(await ws.recv())
            msgs = msgs if isinstance(msgs, list) else [msgs]
            logger.info("AUTH %s", msgs)
            if any(m.get("T") == "success" and m.get("msg") == "authenticated" for m in msgs):
                break
            if any(m.get("T") == "error" for m in msgs):
                raise RuntimeError(f"Auth failed: {msgs}")

        # 3. Subscribe
        #    trades  → T == "t"
        #    quotes  → T == "q"  (NBBO best bid/ask)
        #    bars    → T == "b"  (minute bars, fires on bar close)
        sub = {
            "action":      "subscribe",
            "trades":      SYMS,
            "quotes":      SYMS,
            "bars":        SYMS,   # closed 1-min bars
            "updatedBars": SYMS,   # live in-progress bar updates
        }
        await ws.send(json.dumps(sub))
        ack = json.loads(await ws.recv())
        logger.info("SUB ack: %s", ack)

        # 4. Event loop
        async for raw in ws:
            msgs = json.loads(raw)
            msgs = msgs if isinstance(msgs, list) else [msgs]

            for m in msgs:
                T   = m.get("T")
                sym = m.get("S")

                # ── control messages (no symbol) ──────────────────────────
                if T in ("subscription", "success", "error") and sym is None:
                    logger.info("SYS %s", m)
                    if T == "error":
                        raise RuntimeError(f"Stream error: {m}")
                    continue

                if sym not in state:
                    continue

                st = state[sym]

                # ── trade ─────────────────────────────────────────────────
                # Fields: p=price, s=size, t=timestamp, c=conditions, x=exchange
                if T == "t":
                    st["last_px"] = m.get("p")
                    st["last_sz"] = m.get("s")

                # ── quote (NBBO) ──────────────────────────────────────────
                # Fields: bp=bid price, bs=bid size, ap=ask price, as=ask size
                elif T == "q":
                    st["bid_px"] = m.get("bp")
                    st["bid_sz"] = m.get("bs")
                    st["ask_px"] = m.get("ap")
                    st["ask_sz"] = m.get("as")

                # ── bars (closed minute bar T=b, live update T=u) ─────────
                # Fields: o/h/l/c=ohlc, v=volume, t=bar-start timestamp
                elif T in ("b", "u"):
                    st["bar"] = {
                        "o": m.get("o"),
                        "h": m.get("h"),
                        "l": m.get("l"),
                        "c": m.get("c"),
                        "v": m.get("v"),
                        "t": m.get("t"),
                    }
                    if T == "b":
                        logger.info(
                            "MINUTE BAR  %s  o=%.4f h=%.4f l=%.4f c=%.4f v=%s  t=%s",
                            sym, m["o"], m["h"], m["l"], m["c"], m["v"], m["t"],
                        )

                
                now = time.monotonic()
                if now - st["last_print"] >= PRINT_EVERY:
                    logger.info("\n%s", fmt_quote(sym, st))
                    st["last_print"] = now


if __name__ == "__main__":
    asyncio.run(main())