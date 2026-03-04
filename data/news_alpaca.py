import requests
from dotenv import load_dotenv
import os
import sys
import logging
from pprint import pprint
from db.runtime import get_commander
from data.ticker_list import TICKERS

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger("news_alpaca")

API_KEY = os.getenv("ALPACA_API_KEY")
API_SECRET = os.getenv("ALPACA_API_SECRET")

assert API_KEY, "ALPACA_API_KEY must be set in .env file"
assert API_SECRET, "ALPACA_API_SECRET must be set in .env file"


def get_raw_ticker_news_data(ticker_symbol=None) -> list[dict]:
    if ticker_symbol is None:
        logger.warning("No ticker symbol provided to get news. Please provide a ticker symbol as an argument.")
        return

    logger.info(f"Fetching news for ticker: {ticker_symbol}")
    url = 'https://data.alpaca.markets/v1beta1/news'
    params = {
        'symbols': ticker_symbol
    }

    response = requests.get(url, headers={
        'APCA-API-KEY-ID': API_KEY,
        'APCA-API-SECRET-KEY': API_SECRET
    }, params=params)

    if response.status_code == 200:
        news = response.json().get('news', [])

    else:
        logger.error(f"Error: {response.status_code} {response.text}")

    return news

def store_raw_ticker_news_data(ticker_symbol, raw_news):
    """
    Store the raw news data for a given ticker symbol in the database.
    """
    if not raw_news:
        logger.warning(f"No news data to store for ticker: {ticker_symbol}")
        return

    try:
        commander = get_commander()
        commander.store_raw_ticker_news(ticker_symbol, raw_news)
        logger.info(f"Stored {len(raw_news)} news articles for ticker: {ticker_symbol}")
    except Exception as e:
        logger.error(f"Failed to store news for ticker {ticker_symbol}: {e}")

def clean_news_data(raw_news):
    """
    Clean the raw news data from Alpaca API.
    This function extracts relevant fields and formats them into a list of dictionaries.
    """
    cleaned_news = []
    for article in raw_news:
        cleaned_article = {
            "id": int(article.get("id")),
            "author": article.get("author"),
            "title": article.get("title"),
            "url": article.get("url"),
            "created_at": article.get("created_at"),
            "source": article.get("source"),
            "headline": article.get("headline"),
            "summary": article.get("summary")
        }
        cleaned_news.append(cleaned_article)
    
    return cleaned_news

def store_clean_ticker_news_data(ticker_symbol, cleaned_news):
    """
    Store the cleaned news data for a given ticker symbol in the database.
    """
    if not cleaned_news:
        logger.warning(f"No cleaned news data to store for ticker: {ticker_symbol}")
        return

    try:
        commander = get_commander()
        commander.store_clean_ticker_news(ticker_symbol, cleaned_news)
        logger.info(f"Stored {len(cleaned_news)} cleaned news articles for ticker: {ticker_symbol}")
    except Exception as e:
        logger.error(f"Failed to store cleaned news for ticker {ticker_symbol}: {e}")

def run_stock_news_pipeline(ticker_symbols:list[str] = TICKERS):
    if ticker_symbols is None:
        logger.warning("No ticker symbols provided. Please provide ticker symbol as an argument.")
        return

    comm = get_commander()  
    for ticker_symbol in ticker_symbols:
        raw_data = get_raw_ticker_news_data(ticker_symbol)
        comm.store_raw_ticker_news(ticker_symbol, raw_data)

        clean_data = clean_news_data(raw_data)
        comm.store_clean_ticker_news(ticker_symbol, clean_data)

if __name__ == '__main__':
    if len(sys.argv) > 1:
        ticker_symbols = sys.argv[1:]
        run_stock_news_pipeline(ticker_symbols)
    else:
        run_stock_news_pipeline()