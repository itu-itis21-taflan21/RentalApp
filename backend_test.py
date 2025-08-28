#!/usr/bin/env python3
"""
Comprehensive Backend API Tests for P2P Rental Marketplace
Tests all authentication, item management, booking, and review APIs
"""

import requests
import json
import base64
from datetime import datetime, timedelta
from typing import Dict, Any, List
import uuid
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/frontend/.env')

# Configuration
BASE_URL = os.getenv('EXPO_PUBLIC_BACKEND_URL', 'https://lendloop-3.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"

# Test data storage
test_data = {
    'users': [],
    'tokens': [],
    'items': [],
    'bookings': [],
    'reviews': []
}

# Sample base64 image (small 1x1 pixel PNG)
SAMPLE_IMAGE_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

def print_test_result(test_name: str, success: bool, details: str = ""):
    """Print formatted test results"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} {test_name}")
    if details:
        print(f"   Details: {details}")
    if not success:
        print()

def make_request(method: str, endpoint: str, data: Dict = None, headers: Dict = None, token: str = None) -> Dict[str, Any]:
    """Make HTTP request with error handling"""
    url = f"{API_BASE}{endpoint}"
    
    request_headers = {"Content-Type": "application/json"}
    if headers:
        request_headers.update(headers)
    if token:
        request_headers["Authorization"] = f"Bearer {token}"
    
    try:
        if method.upper() == "GET":
            response = requests.get(url, headers=request_headers, params=data, timeout=30)
        elif method.upper() == "POST":
            response = requests.post(url, json=data, headers=request_headers, timeout=30)
        elif method.upper() == "PUT":
            response = requests.put(url, json=data, headers=request_headers, timeout=30)
        elif method.upper() == "DELETE":
            response = requests.delete(url, headers=request_headers, timeout=30)
        else:
            return {"error": f"Unsupported method: {method}"}
        
        return {
            "status_code": response.status_code,
            "data": response.json() if response.content else {},
            "success": 200 <= response.status_code < 300
        }
    except requests.exceptions.RequestException as e:
        return {"error": str(e), "success": False}
    except json.JSONDecodeError:
        return {"error": "Invalid JSON response", "success": False, "status_code": response.status_code}

def test_user_registration():
    """Test user registration endpoint"""
    print("\n=== Testing User Registration ===")
    
    # Test successful registration
    user_data = {
        "email": "john.doe@example.com",
        "password": "SecurePass123!",
        "first_name": "John",
        "last_name": "Doe",
        "phone": "+1234567890"
    }
    
    response = make_request("POST", "/auth/register", user_data)
    
    if response.get("success") and response.get("status_code") == 200:
        data = response["data"]
        if "user" in data and "token" in data:
            test_data['users'].append(data["user"])
            test_data['tokens'].append(data["token"])
            print_test_result("User Registration", True, f"User ID: {data['user']['id']}")
        else:
            print_test_result("User Registration", False, "Missing user or token in response")
    else:
        print_test_result("User Registration", False, f"Status: {response.get('status_code')}, Error: {response.get('error', 'Unknown')}")
    
    # Test duplicate email registration
    response = make_request("POST", "/auth/register", user_data)
    if response.get("status_code") == 400:
        print_test_result("Duplicate Email Prevention", True, "Correctly rejected duplicate email")
    else:
        print_test_result("Duplicate Email Prevention", False, f"Expected 400, got {response.get('status_code')}")
    
    # Register second user for testing interactions
    user2_data = {
        "email": "jane.smith@example.com",
        "password": "AnotherPass456!",
        "first_name": "Jane",
        "last_name": "Smith",
        "phone": "+1987654321"
    }
    
    response = make_request("POST", "/auth/register", user2_data)
    if response.get("success"):
        data = response["data"]
        test_data['users'].append(data["user"])
        test_data['tokens'].append(data["token"])
        print_test_result("Second User Registration", True, f"User ID: {data['user']['id']}")

def test_user_login():
    """Test user login endpoint"""
    print("\n=== Testing User Login ===")
    
    # Test successful login
    login_data = {
        "email": "john.doe@example.com",
        "password": "SecurePass123!"
    }
    
    response = make_request("POST", "/auth/login", login_data)
    
    if response.get("success") and response.get("status_code") == 200:
        data = response["data"]
        if "user" in data and "token" in data:
            print_test_result("User Login", True, f"Token received for user: {data['user']['email']}")
        else:
            print_test_result("User Login", False, "Missing user or token in response")
    else:
        print_test_result("User Login", False, f"Status: {response.get('status_code')}")
    
    # Test invalid credentials
    invalid_login = {
        "email": "john.doe@example.com",
        "password": "WrongPassword"
    }
    
    response = make_request("POST", "/auth/login", invalid_login)
    if response.get("status_code") == 400:
        print_test_result("Invalid Credentials Rejection", True, "Correctly rejected invalid password")
    else:
        print_test_result("Invalid Credentials Rejection", False, f"Expected 400, got {response.get('status_code')}")

def test_user_profile():
    """Test user profile endpoints"""
    print("\n=== Testing User Profile Management ===")
    
    if not test_data['tokens']:
        print_test_result("Profile Test Setup", False, "No authentication tokens available")
        return
    
    token = test_data['tokens'][0]
    
    # Test get current user
    response = make_request("GET", "/auth/me", token=token)
    
    if response.get("success"):
        user = response["data"]
        print_test_result("Get Current User", True, f"Retrieved profile for: {user.get('email')}")
    else:
        print_test_result("Get Current User", False, f"Status: {response.get('status_code')}")
    
    # Test profile update
    update_data = {
        "bio": "Passionate about sharing and renting quality items in the community",
        "profile_photo": SAMPLE_IMAGE_B64,
        "location": {"lat": 40.7128, "lng": -74.0060}
    }
    
    response = make_request("PUT", "/users/profile", update_data, token=token)
    
    if response.get("success"):
        updated_user = response["data"]
        print_test_result("Profile Update", True, f"Updated bio and location for user")
    else:
        print_test_result("Profile Update", False, f"Status: {response.get('status_code')}")

def test_item_management():
    """Test item CRUD operations"""
    print("\n=== Testing Item Management ===")
    
    if not test_data['tokens']:
        print_test_result("Item Test Setup", False, "No authentication tokens available")
        return
    
    token = test_data['tokens'][0]
    
    # Test item creation
    item_data = {
        "title": "Professional DSLR Camera Canon EOS R5",
        "description": "High-quality mirrorless camera perfect for photography enthusiasts and professionals. Includes 24-105mm lens, extra batteries, and carrying case.",
        "category": "camera",
        "photos": [SAMPLE_IMAGE_B64, SAMPLE_IMAGE_B64],
        "price_per_day": 75.00,
        "price_per_hour": 12.00,
        "location": {"lat": 40.7589, "lng": -73.9851},
        "address": "Manhattan, New York, NY 10001"
    }
    
    response = make_request("POST", "/items", item_data, token=token)
    
    if response.get("success"):
        item = response["data"]
        test_data['items'].append(item)
        print_test_result("Item Creation", True, f"Created item: {item['title'][:30]}...")
    else:
        print_test_result("Item Creation", False, f"Status: {response.get('status_code')}, Error: {response.get('error')}")
    
    # Create second item for testing
    item2_data = {
        "title": "Professional Power Drill Set with Bits",
        "description": "Complete cordless drill set with multiple drill bits, screwdriver attachments, and carrying case. Perfect for home improvement projects.",
        "category": "tools",
        "photos": [SAMPLE_IMAGE_B64],
        "price_per_day": 25.00,
        "location": {"lat": 40.7505, "lng": -73.9934},
        "address": "Brooklyn, New York, NY 11201"
    }
    
    response = make_request("POST", "/items", item2_data, token=token)
    if response.get("success"):
        test_data['items'].append(response["data"])
        print_test_result("Second Item Creation", True, "Created tools category item")
    
    # Test get all items
    response = make_request("GET", "/items")
    
    if response.get("success"):
        items = response["data"]
        print_test_result("Get All Items", True, f"Retrieved {len(items)} items")
    else:
        print_test_result("Get All Items", False, f"Status: {response.get('status_code')}")
    
    # Test item search and filtering
    search_params = {
        "search": "camera",
        "category": "camera",
        "min_price": 50,
        "max_price": 100
    }
    
    response = make_request("GET", "/items", search_params)
    
    if response.get("success"):
        filtered_items = response["data"]
        print_test_result("Item Search & Filter", True, f"Found {len(filtered_items)} camera items in price range")
    else:
        print_test_result("Item Search & Filter", False, f"Status: {response.get('status_code')}")
    
    # Test get specific item
    if test_data['items']:
        item_id = test_data['items'][0]['id']
        response = make_request("GET", f"/items/{item_id}")
        
        if response.get("success"):
            item = response["data"]
            print_test_result("Get Specific Item", True, f"Retrieved item: {item['title'][:30]}...")
        else:
            print_test_result("Get Specific Item", False, f"Status: {response.get('status_code')}")
    
    # Test get my items
    response = make_request("GET", "/items/user/my-items", token=token)
    
    if response.get("success"):
        my_items = response["data"]
        print_test_result("Get My Items", True, f"User has {len(my_items)} items")
    else:
        print_test_result("Get My Items", False, f"Status: {response.get('status_code')}")

def test_categories_and_popular():
    """Test categories and popular items endpoints"""
    print("\n=== Testing Categories and Discovery ===")
    
    # Test get categories
    response = make_request("GET", "/categories")
    
    if response.get("success"):
        categories = response["data"]
        print_test_result("Get Categories", True, f"Retrieved {len(categories)} categories")
    else:
        print_test_result("Get Categories", False, f"Status: {response.get('status_code')}")
    
    # Test popular items
    response = make_request("GET", "/search/popular")
    
    if response.get("success"):
        popular_items = response["data"]
        print_test_result("Get Popular Items", True, f"Retrieved {len(popular_items)} popular items")
    else:
        print_test_result("Get Popular Items", False, f"Status: {response.get('status_code')}")

def test_booking_system():
    """Test booking creation and management"""
    print("\n=== Testing Booking System ===")
    
    if not test_data['tokens'] or not test_data['items']:
        print_test_result("Booking Test Setup", False, "Missing tokens or items for testing")
        return
    
    renter_token = test_data['tokens'][1] if len(test_data['tokens']) > 1 else test_data['tokens'][0]
    owner_token = test_data['tokens'][0]
    item_id = test_data['items'][0]['id']
    
    # Test booking creation
    booking_data = {
        "item_id": item_id,
        "start_date": (datetime.now() + timedelta(days=7)).isoformat(),
        "end_date": (datetime.now() + timedelta(days=10)).isoformat(),
        "notes": "Need this camera for a wedding photography gig. Will take excellent care of it."
    }
    
    response = make_request("POST", "/bookings", booking_data, token=renter_token)
    
    if response.get("success"):
        booking = response["data"]
        test_data['bookings'].append(booking)
        print_test_result("Booking Creation", True, f"Created booking ID: {booking['id']}")
    else:
        print_test_result("Booking Creation", False, f"Status: {response.get('status_code')}, Error: {response.get('error')}")
    
    # Test get my bookings
    response = make_request("GET", "/bookings/my-bookings", token=renter_token)
    
    if response.get("success"):
        bookings = response["data"]
        print_test_result("Get My Bookings (Renter)", True, f"Renter has {len(bookings)} bookings")
    else:
        print_test_result("Get My Bookings (Renter)", False, f"Status: {response.get('status_code')}")
    
    # Test owner viewing bookings
    response = make_request("GET", "/bookings/my-bookings", token=owner_token)
    
    if response.get("success"):
        owner_bookings = response["data"]
        print_test_result("Get My Bookings (Owner)", True, f"Owner has {len(owner_bookings)} bookings")
    else:
        print_test_result("Get My Bookings (Owner)", False, f"Status: {response.get('status_code')}")
    
    # Test booking approval (owner action)
    if test_data['bookings']:
        booking_id = test_data['bookings'][0]['id']
        
        response = make_request("PUT", f"/bookings/{booking_id}/status", 
                              {"status": "approved"}, token=owner_token)
        
        if response.get("success"):
            updated_booking = response["data"]
            print_test_result("Booking Approval", True, f"Booking status: {updated_booking['status']}")
        else:
            print_test_result("Booking Approval", False, f"Status: {response.get('status_code')}")
        
        # Test damage photos upload (before rental)
        damage_photos_data = {
            "photos": [SAMPLE_IMAGE_B64, SAMPLE_IMAGE_B64],
            "photo_type": "before"
        }
        
        response = make_request("POST", f"/bookings/{booking_id}/damage-photos", 
                              damage_photos_data, token=owner_token)
        
        if response.get("success"):
            print_test_result("Damage Photos Upload (Before)", True, "Uploaded before-rental photos")
        else:
            print_test_result("Damage Photos Upload (Before)", False, f"Status: {response.get('status_code')}")
        
        # Test damage photos upload (after rental)
        damage_photos_after = {
            "photos": [SAMPLE_IMAGE_B64],
            "photo_type": "after"
        }
        
        response = make_request("POST", f"/bookings/{booking_id}/damage-photos", 
                              damage_photos_after, token=renter_token)
        
        if response.get("success"):
            print_test_result("Damage Photos Upload (After)", True, "Uploaded after-rental photos")
        else:
            print_test_result("Damage Photos Upload (After)", False, f"Status: {response.get('status_code')}")

def test_payment_processing():
    """Test mock payment processing"""
    print("\n=== Testing Payment Processing ===")
    
    if not test_data['tokens'] or not test_data['bookings']:
        print_test_result("Payment Test Setup", False, "Missing tokens or bookings for testing")
        return
    
    token = test_data['tokens'][0]
    booking_id = test_data['bookings'][0]['id'] if test_data['bookings'] else "test_booking_id"
    
    payment_data = {
        "booking_id": booking_id,
        "payment_method": "credit_card"
    }
    
    response = make_request("POST", "/payments/process", payment_data, token=token)
    
    if response.get("success"):
        payment_result = response["data"]
        print_test_result("Mock Payment Processing", True, f"Payment ID: {payment_result.get('payment_id', 'N/A')}")
    else:
        print_test_result("Mock Payment Processing", False, f"Status: {response.get('status_code')}")

def test_review_system():
    """Test review creation and retrieval"""
    print("\n=== Testing Review System ===")
    
    if not test_data['tokens'] or not test_data['bookings'] or not test_data['items']:
        print_test_result("Review Test Setup", False, "Missing required data for testing")
        return
    
    reviewer_token = test_data['tokens'][1] if len(test_data['tokens']) > 1 else test_data['tokens'][0]
    booking_id = test_data['bookings'][0]['id']
    item_id = test_data['items'][0]['id']
    owner_id = test_data['users'][0]['id']
    
    # Test item review
    item_review_data = {
        "booking_id": booking_id,
        "reviewed_id": item_id,
        "reviewed_type": "item",
        "rating": 5,
        "comment": "Excellent camera! Works perfectly and owner was very helpful with setup instructions. Highly recommend!",
        "photos": [SAMPLE_IMAGE_B64]
    }
    
    response = make_request("POST", "/reviews", item_review_data, token=reviewer_token)
    
    if response.get("success"):
        review = response["data"]
        test_data['reviews'].append(review)
        print_test_result("Item Review Creation", True, f"Created review with rating: {review['rating']}")
    else:
        print_test_result("Item Review Creation", False, f"Status: {response.get('status_code')}, Error: {response.get('error')}")
    
    # Test user review
    user_review_data = {
        "booking_id": booking_id,
        "reviewed_id": owner_id,
        "reviewed_type": "user",
        "rating": 4,
        "comment": "Great owner! Very responsive and item was exactly as described. Smooth transaction overall."
    }
    
    response = make_request("POST", "/reviews", user_review_data, token=reviewer_token)
    
    if response.get("success"):
        user_review = response["data"]
        print_test_result("User Review Creation", True, f"Created user review with rating: {user_review['rating']}")
    else:
        print_test_result("User Review Creation", False, f"Status: {response.get('status_code')}")
    
    # Test get item reviews
    response = make_request("GET", f"/reviews/{item_id}", {"reviewed_type": "item"})
    
    if response.get("success"):
        item_reviews = response["data"]
        print_test_result("Get Item Reviews", True, f"Retrieved {len(item_reviews)} item reviews")
    else:
        print_test_result("Get Item Reviews", False, f"Status: {response.get('status_code')}")
    
    # Test get user reviews
    response = make_request("GET", f"/reviews/{owner_id}", {"reviewed_type": "user"})
    
    if response.get("success"):
        user_reviews = response["data"]
        print_test_result("Get User Reviews", True, f"Retrieved {len(user_reviews)} user reviews")
    else:
        print_test_result("Get User Reviews", False, f"Status: {response.get('status_code')}")

def test_authentication_security():
    """Test authentication and authorization"""
    print("\n=== Testing Authentication Security ===")
    
    # Test accessing protected endpoint without token
    response = make_request("GET", "/auth/me")
    
    if response.get("status_code") == 401:
        print_test_result("Protected Endpoint Security", True, "Correctly rejected request without token")
    else:
        print_test_result("Protected Endpoint Security", False, f"Expected 401, got {response.get('status_code')}")
    
    # Test with invalid token
    response = make_request("GET", "/auth/me", token="invalid_token_123")
    
    if response.get("status_code") == 401:
        print_test_result("Invalid Token Rejection", True, "Correctly rejected invalid token")
    else:
        print_test_result("Invalid Token Rejection", False, f"Expected 401, got {response.get('status_code')}")

def run_all_tests():
    """Run all backend API tests"""
    print("🚀 Starting Comprehensive P2P Rental Marketplace Backend API Tests")
    print(f"📡 Testing against: {API_BASE}")
    print("=" * 80)
    
    try:
        # Authentication tests
        test_user_registration()
        test_user_login()
        test_user_profile()
        test_authentication_security()
        
        # Item management tests
        test_item_management()
        test_categories_and_popular()
        
        # Booking system tests
        test_booking_system()
        test_payment_processing()
        
        # Review system tests
        test_review_system()
        
        print("\n" + "=" * 80)
        print("🏁 Backend API Testing Complete!")
        print(f"📊 Test Summary:")
        print(f"   • Users created: {len(test_data['users'])}")
        print(f"   • Items created: {len(test_data['items'])}")
        print(f"   • Bookings created: {len(test_data['bookings'])}")
        print(f"   • Reviews created: {len(test_data['reviews'])}")
        
    except Exception as e:
        print(f"\n❌ CRITICAL ERROR during testing: {str(e)}")
        return False
    
    return True

if __name__ == "__main__":
    success = run_all_tests()
    exit(0 if success else 1)