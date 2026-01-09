import requests
import json

def test_login():
    url = "http://localhost:5000/api/login"
    payload = {
        "email": "patient.demo@sesphr.com",
        "password": "123456789"
    }
    
    try:
        response = requests.post(url, json=payload)
        print(f"Status Code: {response.status_code}")
        
        data = response.json()
        print("Response JSON keys:", list(data.keys()))
        
        if "data" in data:
            inner_data = data["data"]
            print("Inner data:", inner_data)
            if "user" in inner_data and "role" in inner_data:
                print("SUCCESS: 'user' and 'role' found in data object.")
            else:
                print("FAILURE: 'user' or 'role' NOT found in data object.")
        else:
            print("FAILURE: 'data' key not found in response.")
            
    except Exception as e:
        print(f"Error testing login: {e}")

if __name__ == "__main__":
    test_login()
