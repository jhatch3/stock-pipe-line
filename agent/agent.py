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
        assert self.ticker, "Ticker symbol must be provided"
        
        try:
            commander = get_commander()
            JSON_NEWS = commander.get_ticker_news(self.ticker)
            return json.loads(JSON_NEWS)
        
        except Exception as e:
            logger.warning("Failed to retrieve news for ticker %s: %s", self.ticker, e)
            return {"news": [None]}
    
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