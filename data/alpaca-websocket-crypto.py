"""
Alpaca crypto websocket (trades + orderbooks) with structured logging.
"""
import asyncio
import json
import os
import logging
from pathlib import Path

import websockets
from websockets.exceptions import InvalidStatusCode
import dotenv

dotenv.load_dotenv()

# Use env override if provided; default to latest US crypto stream
URL = os.getenv("ALPACA_CRYPTO_WS", "wss://stream.data.alpaca.markets/v1beta3/crypto/us")

KEY = os.environ["ALPACA_KEY"]
SECRET = os.environ["ALPACA_SECRET"]
assert KEY and SECRET, "You must set ALPACA_KEY and ALPACA_SECRET in env/.env"

SYMS = ["BTC/USD", "ETH/USD"]  # adjust as needed

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger("alpaca_crypto_ws")


async def recv_json(ws):
    raw = await ws.recv()
    try:
        return json.loads(raw)
    except Exception:
        return raw


async def main():
    try:
        async with websockets.connect(URL, ping_interval=20, ping_timeout=10) as ws:
            logger.info("ETL=crypto_ws step=connect layer=meta url=%s", URL)

            # 1) auth first
            await ws.send(json.dumps({"action": "auth", "key": KEY, "secret": SECRET}))
            while True:
                msg = await recv_json(ws)
                msgs = msg if isinstance(msg, list) else [msg]
                if any(m.get("T") == "error" for m in msgs):
                    raise RuntimeError(f"AUTH ERROR: {msgs}")
                if any(m.get("T") == "success" and m.get("msg") == "authenticated" for m in msgs):
                    logger.info("ETL=crypto_ws step=auth layer=meta status=ok")
                    break

            # 2) subscribe trades + orderbooks
            sub_payload = {"action": "subscribe", "trades": SYMS, "orderbooks": SYMS}
            await ws.send(json.dumps(sub_payload))

            # 3) process stream
            async for raw in ws:
                try:
                    events = json.loads(raw)
                except json.JSONDecodeError:
                    continue

                for e in events if isinstance(events, list) else [events]:
                    etype = e.get("T")
                    sym = e.get("S")

                    if etype == "t":  # trade
                        logger.info(
                            "ETL=crypto_ws step=trade layer=raw ticker=%s price=%s size=%s ts=%s",
                            sym, e.get("p"), e.get("s"), e.get("t"),
                        )

                    elif etype == "b":  # bar
                        logger.info("PRICE")
                        logger.info(
                            "ETL=crypto_ws step=bar layer=raw ticker=%s open=%s high=%s low=%s close=%s volume=%s ts=%s",
                            sym, e.get("o"), e.get("h"), e.get("l"), e.get("c"), e.get("v"), e.get("t"),
                        )

                    elif etype == "o":  # orderbook
                        logger.info(
                            "ETL=crypto_ws step=orderbook layer=raw ticker=%s bids=%s asks=%s ts=%s",
                            sym, e.get("b"), e.get("a"), e.get("t"),
                        )

                    elif etype == "h":  # heartbeat
                        logger.info(
                            "ETL=crypto_ws step=heartbeat layer=meta ts=%s",
                            e.get("t"),
                        )

                    elif etype in ("success", "subscription"):
                        logger.info("ETL=crypto_ws step=control layer=meta msg=%s", e)

                    else:
                        logger.info("ETL=crypto_ws step=other layer=raw event=%s", e)

    except InvalidStatusCode as exc:
        logger.error(
            "Connect failed status=%s headers=%s",
            getattr(exc, "status_code", "?"),
            getattr(exc, "headers", "?"),
        )
        raise


if __name__ == "__main__":
    asyncio.run(main())