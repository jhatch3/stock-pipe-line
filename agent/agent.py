"""
Agent Class getting bets

Base Class for each of the sub-agents:


"""
import os, json, requests
import datetime as dt

from openai import OpenAI
from dotenv import load_dotenv
from pprint import pprint 
from time import sleep 

# Load variables from .env file
load_dotenv()
API_KEY = os.getenv("OPENAI_API_KEY")
assert API_KEY != None

class Agent:
    def __init__(self, name: str, input: str, payload: dict | None = None, model: str = "gpt-4.1"):

        self.name = name                                                                          # Unique Silly name ?
        self.model = model                                                                        # Sets the model type 
        self.client = self._make_client()                                                         # Connects to OPEN AI Client 

        self.input = input                                                                        # The input to the model
        self.payload = payload if payload is not None else self._generate_payload()               # Extra Context for model, ie api route, or http response body. Can be passed through by user or defined function.
        self.response = None                                                                      # The models response

    def _make_client(self):
        """
        Docstring for _make_client
        
        :param self: Description

        Sets Open AI Client to prompt too.
        """
        try:
            client =  OpenAI(api_key=API_KEY)
        except Error as e:
            print(f"Error making OPEN AI client !!")

        print(f"Client Connected !!")
        return client 

    def _generate_payload(self):
        raise NotImplemented("def _generate_payload(self) not defined")
         
    
    def _generate_response(self):
        """
        Fetch Gamma markets and keep only selected fields (columns).
        """

        print(f"Making response !!")
        response = self.client.responses.create(
            model=self.model,
            input=self.input
        )

        try:
            self.response = json.loads(response.output_text)[0]
            print(f"Set response !!")
        except Exception as e:
            self.response = {
                "date": dt.date.today().isoformat(),
                "ok": False,
                "status": 400,
                "error": f"Model did not return valid JSON: {e}. Raw: {response.output_text[:500]}"
            }

        return 
    
    def run(self):

        print("Running !!")
        self._generate_response()
        
        if agent.response == None:
            print(f"agent.repsone is None !!")
        else:
            return agent.response
            


if __name__ == "__main__":
    print(f"\n================================================================================================================================\n")    
    agent = Agent(
        name="Get-Bet-Agent-001",
        payload="mock-payload",
        input= """

        You are a JSON-only formatter.

        Output MUST be valid JSON only.
        No markdown. No explanations. No extra text.
        Output MUST be a JSON array of length 10. Nothing else.

       I need data on any subject you can pick, anything you like, you will write a short story. 
       Additionally i need a json in the following format.

       {
       "date": mm/dd/yyyy - hh:mm:ss,
        "ok": True,
        "status": int(200),
       "SAID": cryptographic hash value from hashing this promp. Wont even be real but wonder what chat will put
       "header": string,
       "subtitle": str,
       "text": str,
       "sorces": list[str],
       }
        """)

    
    data = agent.run()
    
    print("\n\n====== Repsonse ======\n")\
    
    if bool(data["ok"]):
        pprint(data)
    
    print("\n\n")

    print(f"================================================================================================================================\n")