# agent/agent.py

import os
import json
import logging
import warnings
import datetime as dt
import sys
from pprint import pprint

from dotenv import load_dotenv
from langsmith import Client
from langsmith.wrappers import wrap_openai
from pydantic import BaseModel, Field
from openai import OpenAI

from db.runtime import get_commander

logger = logging.getLogger(__name__)

# Silence noisy warnings (you can remove if you want)
warnings.filterwarnings("ignore")

load_dotenv()
API_KEY = os.getenv("OPENAI_API_KEY")
assert API_KEY, "OPENAI_API_KEY must be set"


def utc_now_iso_z() -> str:
    """UTC timestamp like 2026-03-03T01:15:00Z"""
    return (
        dt.datetime.now(dt.timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )

class Response(BaseModel):
    summary: str = Field(..., description="Summary of the stock research")
    

class Agent:
    def __init__(
        self,
        ticker: str,
        prompt_name: str = "stock-bot-v1",
        model: str | None = None,
    ):
        self.ticker = ticker.upper().strip()
        self.news  = self._init_news()
        self.model = model
        self.client = self._init_openai_client()
        self.prompt = self._init_prompt(prompt_name)
        self.tools = self._init_tools()

    def _init_news(self):
        # Placeholder for news initialization logic
        return json.dumps({"news": [
    {
      "author": "Aniket Verma",
      "content": "",
      "created_at": "2026-01-22T03:08:46Z",
      "headline": "Nvidia, Microsoft Trading On Solana? Ondo Finance Launches 'Full TradFi Portfolio' Of Stocks, ETFs, Gold On The Blockchain",
      "id": 50058284,
      "images": [
        {
          "size": "large",
          "url": "https://cdn.benzinga.com/files/images/story/2026/01/21/Cryptocurrency-Concept--A-Macro-Shot-Of-.jpeg?width=2048&height=1536"
        },
        {
          "size": "small",
          "url": "https://cdn.benzinga.com/files/images/story/2026/01/21/Cryptocurrency-Concept--A-Macro-Shot-Of-.jpeg?width=1024&height=768"
        },
        {
          "size": "thumb",
          "url": "https://cdn.benzinga.com/files/images/story/2026/01/21/Cryptocurrency-Concept--A-Macro-Shot-Of-.jpeg?width=250&height=187"
        }
      ],
      "source": "benzinga",
      "summary": "Real-world assets tokenization platform Ondo Finance (CRYPTO: ONDO) launched hundreds of blockchain-based stocks, exchange-traded funds, bonds, and commodities on Solana ",
      "symbols": [
        "BNBUSD",
        "EEM",
        "ETHUSD",
        "ICE",
        "MSFT",
        "NVDA",
        "SOL",
        "SOLUSD"
      ],
      "updated_at": "2026-01-22T03:08:47Z",
      "url": "https://www.benzinga.com/crypto/cryptocurrency/26/01/50058284/nvidia-microsoft-trading-on-solana-ondo-finance-launches-full-tradfi-portfolio-of-stocks-etfs-gold-on-the-blockchain"
    },
    {
      "author": "Aniket Verma",
      "content": "",
      "created_at": "2026-01-15T03:03:13Z",
      "headline": "Melania Memecoin Rockets 50% In 2026, Leaves Official Trump Coin Trailing In The Dust As Amazon Documentary Hype Builds",
      "id": 49925603,
      "images": [
        {
          "size": "large",
          "url": "https://cdn.benzinga.com/files/images/story/2026/01/14/Melania-Trump-Waves-At-A-Ceremony-In-Ros.jpeg?width=2048&height=1536"
        },
        {
          "size": "small",
          "url": "https://cdn.benzinga.com/files/images/story/2026/01/14/Melania-Trump-Waves-At-A-Ceremony-In-Ros.jpeg?width=1024&height=768"
        },
        {
          "size": "thumb",
          "url": "https://cdn.benzinga.com/files/images/story/2026/01/14/Melania-Trump-Waves-At-A-Ceremony-In-Ros.jpeg?width=250&height=187"
        }
      ],
      "source": "benzinga",
      "summary": "The Official Melania (CRYPTO: MELANIA) coin has taken off to a rocking start in 2026, building buzz ahead of the highly anticipated documentary on First Lady Melania Trump.",
      "symbols": [
        "BTCUSD",
        "DOGEUSD",
        "ETHUSD",
        "SOL",
        "SOLUSD",
        "TRUMPUSD",
        "ZECUSD"
      ],
      "updated_at": "2026-01-15T03:03:14Z",
      "url": "https://www.benzinga.com/crypto/cryptocurrency/26/01/49925603/melania-memecoin-rockets-50-in-2026-leaves-official-trump-coin-trailing-in-the-dust-as-amazon-documentary-hype-builds"
    },
    {
      "author": "Aniket Verma",
      "content": "",
      "created_at": "2026-01-05T03:50:02Z",
      "headline": "Dogecoin, Shiba Inu Extend New Year Gains, But Pepe, Bonk Top The Pack With Double-Digit Rally",
      "id": 49683249,
      "images": [
        {
          "size": "large",
          "url": "https://cdn.benzinga.com/files/images/story/2026/01/04/Kaufbeuren--Germany---December-04--2021-.jpeg?width=2048&height=1536"
        },
        {
          "size": "small",
          "url": "https://cdn.benzinga.com/files/images/story/2026/01/04/Kaufbeuren--Germany---December-04--2021-.jpeg?width=1024&height=768"
        },
        {
          "size": "thumb",
          "url": "https://cdn.benzinga.com/files/images/story/2026/01/04/Kaufbeuren--Germany---December-04--2021-.jpeg?width=250&height=187"
        }
      ],
      "source": "benzinga",
      "summary": "The new year meme coin frenzy continued on Sunday as major coins extended their gains.",
      "symbols": [
        "BONKUSD",
        "BTCUSD",
        "DOGEUSD",
        "PEPEUSD",
        "SHIBUSD",
        "SOL",
        "SOLUSD",
        "WIFUSD",
        "ZECUSD"
      ],
      "updated_at": "2026-01-05T03:50:03Z",
      "url": "https://www.benzinga.com/crypto/cryptocurrency/26/01/49683249/dogecoin-shiba-inu-extend-new-year-gains-but-pepe-bonk-top-the-pack-with-double-digit-rally"
    },
    {
      "author": "Aniket Verma",
      "content": "",
      "created_at": "2025-12-29T03:17:58Z",
      "headline": "Disappointed By Bitcoin And Dogecoin In 2025? These Coins Soared Over 2000% To Dominate The Gainers List",
      "id": 49603007,
      "images": [
        {
          "size": "large",
          "url": "https://cdn.benzinga.com/files/imagecache/2048x1536xUP/images/story/2025/12/28/Close-Up-Shot-Of-A-Golden-Bitcoin-In-A-S.jpeg"
        },
        {
          "size": "small",
          "url": "https://cdn.benzinga.com/files/imagecache/1024x768xUP/images/story/2025/12/28/Close-Up-Shot-Of-A-Golden-Bitcoin-In-A-S.jpeg"
        },
        {
          "size": "thumb",
          "url": "https://cdn.benzinga.com/files/imagecache/250x187xUP/images/story/2025/12/28/Close-Up-Shot-Of-A-Golden-Bitcoin-In-A-S.jpeg"
        }
      ],
      "source": "benzinga",
      "summary": "Amid a year of big losses for major large-cap cryptocurrencies, two under-the-radar tokens captured the market’s attention by delivering eye-popping returns.",
      "symbols": [
        "BTCUSD",
        "DOGEUSD",
        "SOL",
        "SOLUSD",
        "ZECUSD"
      ],
      "updated_at": "2025-12-29T03:17:58Z",
      "url": "https://www.benzinga.com/crypto/cryptocurrency/25/12/49603007/disappointed-by-bitcoin-and-dogecoin-in-2025-these-coins-soared-over-2000-to-dominate-the-gainers-list"
    },
    {
      "author": "Kenneth Rapoza",
      "content": "",
      "created_at": "2025-12-16T17:19:58Z",
      "headline": "\"Real World Assets\" To Become Even Bigger Crypto Theme In 2026; Could RWA Protocols Like Ondo Finance Finally Trade Evenly With Bitcoin?",
      "id": 49428379,
      "images": [
        {
          "size": "large",
          "url": "https://cdn.benzinga.com/files/imagecache/2048x1536xUP/images/story/2025/12/19/Benzinga-RWA.png"
        },
        {
          "size": "small",
          "url": "https://cdn.benzinga.com/files/imagecache/1024x768xUP/images/story/2025/12/19/Benzinga-RWA.png"
        },
        {
          "size": "thumb",
          "url": "https://cdn.benzinga.com/files/imagecache/250x187xUP/images/story/2025/12/19/Benzinga-RWA.png"
        }
      ],
      "source": "benzinga",
      "summary": "Real World Assets (RWA) have been floating around the crypto universe since around 2015, with mostly conceptual, early experiments. Only now are investors getting excited about them.",
      "symbols": [
        "BTC",
        "BTCUSD",
        "DAO",
        "DAOUSD",
        "ETH",
        "ETHUSD",
        "ONDOUSD",
        "SOL",
        "SOLUSD",
        "XTZUSD"
      ],
      "updated_at": "2025-12-19T16:41:30Z",
      "url": "https://www.benzinga.com/Opinion/25/12/49428379/real-world-assets-to-become-even-bigger-crypto-theme-in-2026-could-rwa-protocols-like-ondo-finance-finally-trade-evenly-with-bitcoin"
    },
    {
      "author": "Benzinga Newsdesk",
      "content": "",
      "created_at": "2025-12-18T12:21:31Z",
      "headline": "Washington Post Reported President Trump Expected To Announce A Medicare Pilot Program To Reimburse Patients' CBD Treatments",
      "id": 49474574,
      "images": [],
      "source": "benzinga",
      "summary": "",
      "symbols": [
        "AAWH",
        "ACB",
        "ALEAF",
        "AUSAF",
        "AVTBF",
        "AYRWF",
        "BBRRF",
        "BHHKF",
        "BLOZF",
        "BMMJ",
        "CANN",
        "CBDY",
        "CBMJ",
        "CBWTF",
        "CGC",
        "CHOOF",
        "CLSH",
        "CLVR",
        "CNBS",
        "CNBX",
        "CNGGF",
        "CNPOF",
        "CNTMF",
        "CNVCF",
        "CPHRF",
        "CRLBF",
        "CRON",
        "CURLF",
        "CURR",
        "CVHIF",
        "CVSI",
        "CWBHF",
        "CWWBF",
        "CXXIF",
        "ELLXF",
        "EMOR",
        "ETST",
        "EVIO",
        "FFLWF",
        "FFNTF",
        "FFRMF",
        "FLGC",
        "FLOOF",
        "FLWPF",
        "FNNZF",
        "FUAPF",
        "GABLF",
        "GBHPF",
        "GENE",
        "GHBWF",
        "GLASF",
        "GLDFF",
        "GNLN",
        "GRAMF",
        "GRNH",
        "GRWG",
        "GSRX",
        "GTBIF",
        "HBOSF",
        "HEMP",
        "HERTF",
        "HHPHF",
        "HMLSF",
        "IIPR",
        "INCR",
        "INLB",
        "ISOLF",
        "ITHUF",
        "IVITF",
        "JWCAF",
        "KALY",
        "KAYS",
        "KHRNF",
        "LBUY",
        "LFCOF",
        "LFLY",
        "LIFD",
        "LMLLF",
        "LNLHF",
        "LOVFF",
        "LRSNF",
        "LVRLF",
        "LXLLF",
        "MAPS",
        "MGCLF",
        "MGWFF",
        "MJ",
        "MJNE",
        "MJUS",
        "MMNFF",
        "MPXOF",
        "MRMD",
        "MXC",
        "NDVAF",
        "NOBDF",
        "NWVCF",
        "OGI",
        "OILFF",
        "PHOT",
        "PKPH",
        "PMD",
        "RHNMF",
        "RMHB",
        "RSSFF",
        "SMG",
        "SNDL",
        "SOL",
        "SOLCF",
        "SSIC",
        "TBPMF",
        "TCNNF",
        "TGIFF",
        "TLLTF",
        "TLRY",
        "TRSSF",
        "TSX:RGI",
        "UGRO",
        "VFF",
        "VREOF",
        "VVCIF",
        "WRLD",
        "XTXXF",
        "XXII",
        "YCBD",
        "YOLO",
        "ZDPY",
        "ZLDAF"
      ],
      "updated_at": "2025-12-18T12:21:32Z",
      "url": "https://www.benzinga.com/news/25/12/49474574/washington-post-reported-president-trump-expected-to-announce-a-medicare-pilot-program-to-reimburse"
    },
    {
      "author": "Benzinga Newsdesk",
      "content": "",
      "created_at": "2025-12-17T13:38:54Z",
      "headline": "'Trump to sign executive order reclassifying marijuana: Officials' -ABC Report",
      "id": 49446890,
      "images": [],
      "source": "benzinga",
      "summary": "",
      "symbols": [
        "AAWH",
        "ACB",
        "ALEAF",
        "AUSAF",
        "AVTBF",
        "AYRWF",
        "BBRRF",
        "BHHKF",
        "BLOZF",
        "BMMJ",
        "CANN",
        "CBDY",
        "CBMJ",
        "CBWTF",
        "CGC",
        "CHOOF",
        "CLSH",
        "CLVR",
        "CNBS",
        "CNBX",
        "CNGGF",
        "CNPOF",
        "CNTMF",
        "CNVCF",
        "CPHRF",
        "CRLBF",
        "CRON",
        "CURLF",
        "CURR",
        "CVHIF",
        "CVSI",
        "CWBHF",
        "CWWBF",
        "CXXIF",
        "ELLXF",
        "EMOR",
        "ETST",
        "EVIO",
        "FFLWF",
        "FFNTF",
        "FFRMF",
        "FLGC",
        "FLOOF",
        "FLWPF",
        "FNNZF",
        "FUAPF",
        "GABLF",
        "GBHPF",
        "GENE",
        "GHBWF",
        "GLASF",
        "GLDFF",
        "GNLN",
        "GRAMF",
        "GRNH",
        "GRWG",
        "GSRX",
        "GTBIF",
        "HBOSF",
        "HEMP",
        "HERTF",
        "HHPHF",
        "HMLSF",
        "IIPR",
        "INCR",
        "INLB",
        "ISOLF",
        "ITHUF",
        "IVITF",
        "JWCAF",
        "KALY",
        "KAYS",
        "KHRNF",
        "LBUY",
        "LFCOF",
        "LFLY",
        "LIFD",
        "LMLLF",
        "LNLHF",
        "LOVFF",
        "LRSNF",
        "LVRLF",
        "LXLLF",
        "MAPS",
        "MGCLF",
        "MGWFF",
        "MJ",
        "MJNE",
        "MJUS",
        "MMNFF",
        "MPXOF",
        "MRMD",
        "MXC",
        "NDVAF",
        "NOBDF",
        "NWVCF",
        "OGI",
        "OILFF",
        "PHOT",
        "PKPH",
        "PMD",
        "RHNMF",
        "RMHB",
        "RSSFF",
        "SMG",
        "SNDL",
        "SOL",
        "SOLCF",
        "SSIC",
        "TBPMF",
        "TCNNF",
        "TGIFF",
        "TLLTF",
        "TLRY",
        "TRSSF",
        "TSX:RGI",
        "UGRO",
        "VFF",
        "VREOF",
        "VVCIF",
        "WRLD",
        "XTXXF",
        "XXII",
        "YCBD",
        "YOLO",
        "ZDPY",
        "ZLDAF"
      ],
      "updated_at": "2025-12-17T13:38:55Z",
      "url": "https://www.benzinga.com/news/25/12/49446890/trump-to-sign-executive-order-reclassifying-marijuana-officials-abc-report"
    },
    {
      "author": "Hillary Remy",
      "content": "",
      "created_at": "2025-12-12T12:37:38Z",
      "headline": "Solana Flips Ethereum In New Developer Activity: Is SOL The True Consumer Chain For 2026?",
      "id": 49358225,
      "images": [],
      "source": "benzinga",
      "summary": "Solana (CRYPTO: SOL) achieved what seemed impossible just years ago. In the first nine months of 2025, Solana Inc.",
      "symbols": [
        "BLK",
        "COIN",
        "ETHUSD",
        "IVZ",
        "JPM",
        "SOL",
        "SOLUSD"
      ],
      "updated_at": "2025-12-12T12:37:39Z",
      "url": "https://www.benzinga.com/Opinion/25/12/49358225/solana-flips-ethereum-in-new-developer-activity-is-sol-the-true-consumer-chain-for-2026"
    },
    {
      "author": "Aniket Verma",
      "content": "",
      "created_at": "2025-12-12T03:03:07Z",
      "headline": "Anthony Scaramucci Applauds JPMorgan's Blockchain Move, Calls It 'Good News' For His Solana And Avalanche Investment Thesis",
      "id": 49353276,
      "images": [
        {
          "size": "large",
          "url": "https://cdn.benzinga.com/files/imagecache/2048x1536xUP/images/story/2025/12/11/Anthony-Scaramucci-Says-SCOTUS-Could-Han_1.jpeg"
        },
        {
          "size": "small",
          "url": "https://cdn.benzinga.com/files/imagecache/1024x768xUP/images/story/2025/12/11/Anthony-Scaramucci-Says-SCOTUS-Could-Han_1.jpeg"
        },
        {
          "size": "thumb",
          "url": "https://cdn.benzinga.com/files/imagecache/250x187xUP/images/story/2025/12/11/Anthony-Scaramucci-Says-SCOTUS-Could-Han_1.jpeg"
        }
      ],
      "source": "benzinga",
      "summary": "SkyBridge Capital founder Anthony Scaramucci stated Thursday that JPMorgan Chase &amp; Co.’s (NYSE:JPM) move to issue debt securities using Solana ",
      "symbols": [
        "AGRI",
        "AVAXUSD",
        "ETHUSD",
        "GLXY",
        "JPM",
        "SOL",
        "SOLUSD"
      ],
      "updated_at": "2025-12-12T03:03:07Z",
      "url": "https://www.benzinga.com/crypto/cryptocurrency/25/12/49353276/anthony-scaramucci-applauds-jpmorgans-blockchain-move-calls-it-good-news-for-his-solana-and-avalanche-investment-thesis"
    },
    {
      "author": "Hillary Remy",
      "content": "",
      "created_at": "2025-12-08T15:21:18Z",
      "headline": "Coinbase Bridges Base To Solana: Broader Market Implications",
      "id": 49259235,
      "images": [],
      "source": "benzinga",
      "summary": "Coinbase Global Inc.",
      "symbols": [
        "BTCUSD",
        "COIN",
        "SOL",
        "SOLUSD"
      ],
      "updated_at": "2025-12-08T15:21:18Z",
      "url": "https://www.benzinga.com/Opinion/25/12/49259235/coinbase-base-bridges-to-solana-broader-market-implications"
    }
  ],
  "next_page_token": "MTc2NTIwNzI3ODAwMDAwMDAwMHw0OTI1OTIzNQ=="
})
    
    def _init_openai_client(self):
        base_client = OpenAI(api_key=API_KEY)
        return wrap_openai(base_client)

    def _init_tools(self):
        return [{"type": "web_search_preview"}]

    def _init_prompt(self, prompt_name: str):
        client = Client()
        return client.pull_prompt(prompt_name, include_model=False)


    def _generate_raw_response(self):
        system_text = self.prompt.format(TICKER=self.ticker, NEWS_JSON=self.news)

        return self.client.responses.parse(
            model=("gpt-4o-mini" if self.model is None else self.model),
            input=[{"role": "system", "content": system_text}],
            tools=self.tools,         
            text_format=Response
            )
    
    def _clean_response(self, response) -> dict:
        return json.loads(response.output_text)

    def _store_response(self, record: dict):
        commander = get_commander()
        commander._store_response(record)

    def run(self, debug: bool = False) -> dict:
        raw = self._generate_raw_response()
        if debug:
            pprint(raw)

        payload = self._clean_response(raw)

        full_record = {
            "ticker": self.ticker,
            "as_of_utc": utc_now_iso_z(),
            "summary": payload.get("summary"),
            "sources": payload.get("sources"),
        }

        logger.info("Agent generated response for %s at %s", self.ticker, full_record["as_of_utc"])
        #self._store_response(full_record)
        return full_record


def main(argv: list[str]):
    if len(argv) < 1:
        print("Usage: python -m agent.agent <TICKER> [MODEL]")
        return

    ticker = str(argv[0])
    model = str(argv[1]) if len(argv) > 1 else None

    print(f"Running agent for ticker: {ticker} (model={model or 'gpt-4.1-mini (Default)'})")
    agent = Agent(ticker=ticker, model=model)
    result = agent.run(debug=False)

    print("Agent Response:")
    pprint(result.get("summary"))

if __name__ == "__main__":
    main(sys.argv[1:])