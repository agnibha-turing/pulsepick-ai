import requests

# Call the fetch API endpoint
response = requests.post("http://localhost:8000/api/v1/articles/fetch")
print(f"Status Code: {response.status_code}")
print(f"Response: {response.json()}")
