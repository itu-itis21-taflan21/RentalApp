#!/usr/bin/env python3
"""
Debug specific API issues
"""

import requests
import json
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

load_dotenv('/app/frontend/.env')

BASE_URL = os.getenv('EXPO_PUBLIC_BACKEND_URL', 'https://lendloop-3.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"

def debug_request(method, endpoint, data=None, token=None):
    """Debug a specific request"""
    url = f"{API_BASE}{endpoint}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    print(f"\n🔍 Testing: {method} {url}")
    if data:
        print(f"📤 Data: {json.dumps(data, indent=2)}")
    
    try:
        if method == "PUT":
            response = requests.put(url, json=data, headers=headers, timeout=30)
        elif method == "POST":
            response = requests.post(url, json=data, headers=headers, timeout=30)
        elif method == "GET":
            response = requests.get(url, headers=headers, timeout=30)
        
        print(f"📊 Status: {response.status_code}")
        print(f"📥 Response: {response.text}")
        
        return response.status_code, response.text
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return None, str(e)

# First, let's register and get a token
print("=== Getting Authentication Token ===")
user_data = {
    "email": "debug@test.com",
    "password": "TestPass123!",
    "first_name": "Debug",
    "last_name": "User"
}

status, response = debug_request("POST", "/auth/register", user_data)
if status == 200:
    data = json.loads(response)
    token = data["token"]
    user_id = data["user"]["id"]
    print(f"✅ Got token: {token[:20]}...")
else:
    print("❌ Failed to get token")
    exit(1)

# Test profile update
print("\n=== Testing Profile Update ===")
profile_data = {
    "bio": "Test bio",
    "location": {"lat": 40.7128, "lng": -74.0060}
}
debug_request("PUT", "/users/profile", profile_data, token)

# Create an item first
print("\n=== Creating Item ===")
item_data = {
    "title": "Test Camera",
    "description": "Test description",
    "category": "camera",
    "photos": ["test_base64"],
    "price_per_day": 50.0,
    "location": {"lat": 40.7128, "lng": -74.0060},
    "address": "Test Address"
}
status, response = debug_request("POST", "/items", item_data, token)
if status == 200:
    item = json.loads(response)
    item_id = item["id"]
    print(f"✅ Created item: {item_id}")
else:
    print("❌ Failed to create item")
    exit(1)

# Create a booking
print("\n=== Creating Booking ===")
booking_data = {
    "item_id": item_id,
    "start_date": (datetime.now() + timedelta(days=1)).isoformat(),
    "end_date": (datetime.now() + timedelta(days=3)).isoformat(),
    "notes": "Test booking"
}
status, response = debug_request("POST", "/bookings", booking_data, token)
if status == 200:
    booking = json.loads(response)
    booking_id = booking["id"]
    print(f"✅ Created booking: {booking_id}")
else:
    print("❌ Failed to create booking")
    exit(1)

# Test booking status update
print("\n=== Testing Booking Status Update ===")
status_data = {"status": "approved"}
debug_request("PUT", f"/bookings/{booking_id}/status", status_data, token)

# Test damage photos
print("\n=== Testing Damage Photos ===")
damage_data = {
    "photos": ["test_base64_image"],
    "photo_type": "before"
}
debug_request("POST", f"/bookings/{booking_id}/damage-photos", damage_data, token)

# Test payment
print("\n=== Testing Payment ===")
payment_data = {
    "booking_id": booking_id,
    "payment_method": "credit_card"
}
debug_request("POST", "/payments/process", payment_data, token)