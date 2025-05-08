import requests
from app.core.config import settings

def test_newsapi():
    # Get API key
    api_key = settings.NEWSAPI_KEY
    print(f"API Key: {api_key[:5]}...")
    
    # Set parameters
    params = {
        'q': 'artificial intelligence',
        'sortBy': 'publishedAt',
        'pageSize': 5,
        'language': 'en',
        'apiKey': api_key
    }
    
    # Make request
    try:
        response = requests.get('https://newsapi.org/v2/everything', params=params)
        print(f"Status: {response.status_code}")
        
        # Parse response
        data = response.json()
        print(f"Total Results: {data.get('totalResults', 0)}")
        
        # Print sample headlines
        print("Sample Headlines:")
        for article in data.get('articles', [])[:3]:
            print(f"- {article.get('title')}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_newsapi()
