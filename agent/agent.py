import os
import json
import openai
from dotenv import load_dotenv
from langsmith import traceable, Client
from langsmith.wrappers import wrap_openai
from openai import OpenAI
from pprint import pprint  
import warnings
import datetime as dt
import json, re

# UserWarning: WARNING! extra_headers is not default parameter.
warnings.filterwarnings("ignore")

load_dotenv()
API_KEY = os.getenv("OPENAI_API_KEY")
assert API_KEY, "OPENAI_API_KEY must be set"

class Agent:
    def __init__(self, ticker:str, prompt_name: str = "basic-stock-research-assistant", model: str = None):
        self.ticker = ticker
        self.date = dt.datetime.now().strftime("%Y-%m-%d")
        self.model = model
        
        self.client = self._init_openai_client()
        
        self.prompt = self.init_prompt(prompt_name) 
        self.tools = self._init_tools()

    def _init_openai_client(self):

        base_client = OpenAI(api_key=API_KEY)
        return wrap_openai(base_client)

    def _init_tools(self):
        return [
            {
                "type": "web_search_preview"
            }
        ]

    def init_prompt(self, prompt_name: str):
        client = Client()
        return client.pull_prompt(prompt_name, include_model=False)  # just the template, no model config
    
    def to_dict(self, text: str) -> dict:
        m = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text, flags=re.I)
        json_str = m.group(1).strip() if m else text.strip()
        return json.loads(json_str)

    def run(self) -> str:
        messages = self.prompt.format_messages(TICKER=self.ticker, DATE=self.date)
        
        input_list = [
            {
                "role": "user" if msg.type == "human" else msg.type,
                "content": msg.content
            }
            for msg in messages
        ]

        response = self.client.responses.create(
            model=self.model or "gpt-4o-mini",
            input=input_list,
            tools=self.tools,
        )

        return self.to_dict(response.dict().get("output", [{}])[1].get("content", {})[0].get("text", ""))

agent = Agent(ticker="AAPL")
response = agent.run()
print("Agent Response:")
pprint(response)