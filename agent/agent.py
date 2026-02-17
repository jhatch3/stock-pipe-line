import os
import json
import datetime as dt
from openai import OpenAI
from dotenv import load_dotenv

from pprint import pprint

# Load variables from .env file
load_dotenv()
API_KEY = os.getenv("OPEN_AI_KEY")
assert API_KEY is not None, "API_KEY must be set in .env file"

class Agent:
    def __init__(self, input: str, model: str = "gpt-4o-mini-search-preview"):
        self.input = input  # The input to the model
        self.model = model  # Sets the model type
        self.client = self._make_client()  # Connects to OpenAI Client
        self.response = None  # The model's response

    def _make_client(self):
        """
        Sets OpenAI Client to prompt.
        """
        try:
            client = OpenAI(api_key=API_KEY)
            print(f"Client Connected!!")
            return client
        except Exception as e:
            print(f"Error making OpenAI client: {e}")
            raise

    def _generate_payload(self):
        #TODO: MAYBE PROCESS DATA 
        return {
            "model": self.model,
            "messages": [
                {"role": "user", "content": self.input}
            ],
            "web_search_options": {},   
        }

    def _generate_response(self):
        """
        Generate response from OpenAI API.
        """
        print(f"Making response!!")
        
        try:
            payload = self._generate_payload()
            response = self.client.chat.completions.create(**payload)
            
            # Extract the response content
            response_text = response.choices[0].message.content
            
            # Try to parse as JSON
            try:
                self.response = json.loads(response_text)
                print(f"Set response!!")
            except json.JSONDecodeError as e:
                self.response = {
                    "date": dt.date.today().isoformat(),
                    "ok": False,
                    "status": 400,
                    "error": f"Model did not return valid JSON: {e}. Raw: {response_text[:500]}"
                }
        except Exception as e:
            self.response = {
                "date": dt.date.today().isoformat(),
                "ok": False,
                "status": 500,
                "error": f"API call failed: {str(e)}"
            }

    def run(self):
        """
        Execute the agent and return the response.
        """
        print("Running!!")
        self._generate_response()
        
        if self.response is None:
            print(f"self.response is None!!")
            return None
        else:
            return self.response


if __name__ == "__main__":
    print(f"\n{'=' * 128}\n")
    
    TICKER = "CAT"
    SCHEMA = {
    "ticker": "string",
    "last_updated": "ISO-8601 datetime string",
    "ai_summary": "string (<= 4500 chars)"
    }

    agent = Agent(
        input=f"""You are a financial analysis engine that produces a concise but in-depth ticker brief for database storage.

    HARD RULES:
    - Output MUST be valid JSON only. No markdown, no commentary.
    - Do NOT fabricate facts, numbers, quotes, or "latest news". If data is missing, say so explicitly.
    - ai_summary MUST be <= 4500 characters, do not feel like you have to fill it all up.
    - Use the provided as_of_datetime as the "last_updated" time.

    TASK: Analyze the ticker: {TICKER}.

    CONTEXT (may be empty):
    As-of datetime: 2025-02-15T10:00:00Z # ALWAYS INCLUDE
    Price & market data: 
    Fundamentals: 
    News: 
    Filings/excerpts:
    Earnings call/excerpts: 
    Other context:
    Provide summary oncompy like CEO, CTO, famous workers, HQ location, sector, and a little history, 
    Addintionally what makes them unique.
    Overall sentiment
    
    Overall this should sound like someone who is skilled at elvaluating businesses and know exactly what matters and does not 

    the ai summarry should be in a basic paragrph form with not new line values or bolding or any one sort of formating
    OUTPUT JSON SCHEMA:

    {
        SCHEMA
    }

    Return ONLY the JSON object."""
    )
    
    data = agent.run()
    
    print("\n\n====== Response ======\n")
    if data:

        pprint(data.get("ticker", " "))
        pprint(data.get("last_updated", " "))
        pprint(data.get("ai_summary", " "))

    print("\n")
    print(f"{'=' * 128}\n")