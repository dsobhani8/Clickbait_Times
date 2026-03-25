import os
from dotenv import load_dotenv

load_dotenv()

NEWS_API_KEY = os.getenv("NEWS_API_KEY")
IMAGE_URL = 'https://dims.apnews.com/dims4/default/dcac1a4/2147483647/strip/true/crop/700x394+0+28/resize/1440x810!/quality/90/?url=https%3A%2F%2Fassets.apnews.com%2F90%2F29%2F4e3c1cc7446089a9101a7bdff4c8%2Fdefaultshareimage-copy.png'
MIN_WORDS = 100
MAX_WORDS = 1500
ARTICLES_PER_DAY = 50
UPDATE_FREQUENCY = 1 # in hours