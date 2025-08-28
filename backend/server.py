from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
from bson import ObjectId
import hashlib
import jwt
import base64
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI(title="LendLoop - P2P Rental Marketplace API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()
SECRET_KEY = "lendloop_secret_key_2025"  # In production, use environment variable

# Enums
class UserRole(str, Enum):
    USER = "user"
    ADMIN = "admin"

class BookingStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    ACTIVE = "active"
    COMPLETED = "completed"
    DISPUTED = "disputed"

class ItemCategory(str, Enum):
    CAMERA = "camera"
    TOOLS = "tools"
    CAMPING = "camping"
    ELECTRONICS = "electronics"
    SPORTS = "sports"
    AUTOMOTIVE = "automotive"
    HOME = "home"
    OTHER = "other"

class DisputeStatus(str, Enum):
    OPEN = "open"
    INVESTIGATING = "investigating"
    RESOLVED = "resolved"

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    phone: Optional[str] = None
    password_hash: str
    first_name: str
    last_name: str
    profile_photo: Optional[str] = None  # base64
    bio: Optional[str] = None
    is_verified: bool = False
    verification_document: Optional[str] = None  # base64
    rating: float = 0.0
    total_reviews: int = 0
    role: UserRole = UserRole.USER
    location: Optional[Dict[str, float]] = None  # {"lat": 0.0, "lng": 0.0}
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True

class UserCreate(BaseModel):
    email: EmailStr
    phone: Optional[str] = None
    password: str
    first_name: str
    last_name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserProfile(BaseModel):
    id: str
    email: str
    phone: Optional[str]
    first_name: str
    last_name: str
    profile_photo: Optional[str]
    bio: Optional[str]
    is_verified: bool
    rating: float
    total_reviews: int
    location: Optional[Dict[str, float]]
    created_at: datetime

class Item(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    owner_id: str
    title: str
    description: str
    category: ItemCategory
    photos: List[str] = []  # base64 images
    price_per_day: float
    price_per_hour: Optional[float] = None
    location: Dict[str, float]  # {"lat": 0.0, "lng": 0.0}
    address: str
    availability_calendar: List[str] = []  # List of unavailable dates in ISO format
    is_available: bool = True
    rating: float = 0.0
    total_reviews: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class ItemCreate(BaseModel):
    title: str
    description: str
    category: ItemCategory
    photos: List[str] = []
    price_per_day: float
    price_per_hour: Optional[float] = None
    location: Dict[str, float]
    address: str

class Booking(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    item_id: str
    renter_id: str
    owner_id: str
    start_date: datetime
    end_date: datetime
    total_amount: float
    deposit_amount: float
    status: BookingStatus = BookingStatus.PENDING
    payment_id: Optional[str] = None  # Mock payment ID
    damage_photos_before: List[str] = []  # base64 images
    damage_photos_after: List[str] = []
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class BookingCreate(BaseModel):
    item_id: str
    start_date: datetime
    end_date: datetime
    notes: Optional[str] = None

class Review(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    booking_id: str
    reviewer_id: str
    reviewed_id: str  # Can be user or item
    reviewed_type: str  # "user" or "item"
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = None
    photos: List[str] = []  # base64 images
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ReviewCreate(BaseModel):
    booking_id: str
    reviewed_id: str
    reviewed_type: str
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = None
    photos: List[str] = []

class Dispute(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    booking_id: str
    reported_by: str
    reported_against: str
    reason: str
    description: str
    evidence_photos: List[str] = []  # base64 images
    status: DisputeStatus = DisputeStatus.OPEN
    admin_notes: Optional[str] = None
    resolution: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    resolved_at: Optional[datetime] = None

# Helper functions
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed

def create_access_token(user_id: str) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.utcnow() + timedelta(days=7)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=["HS256"])
        return payload["user_id"]
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

# Auth endpoints
@api_router.post("/auth/register", response_model=Dict[str, Any])
async def register(user_data: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user = User(
        email=user_data.email,
        phone=user_data.phone,
        password_hash=hash_password(user_data.password),
        first_name=user_data.first_name,
        last_name=user_data.last_name
    )
    
    await db.users.insert_one(user.dict())
    token = create_access_token(user.id)
    
    return {
        "user": UserProfile(**user.dict()),
        "token": token,
        "message": "Registration successful"
    }

@api_router.post("/auth/login", response_model=Dict[str, Any])
async def login(login_data: UserLogin):
    user_doc = await db.users.find_one({"email": login_data.email})
    if not user_doc or not verify_password(login_data.password, user_doc["password_hash"]):
        raise HTTPException(status_code=400, detail="Invalid credentials")
    
    user = User(**user_doc)
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Account is deactivated")
    
    token = create_access_token(user.id)
    return {
        "user": UserProfile(**user.dict()),
        "token": token,
        "message": "Login successful"
    }

@api_router.get("/auth/me", response_model=UserProfile)
async def get_current_user(user_id: str = Depends(verify_token)):
    user_doc = await db.users.find_one({"id": user_id})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    return UserProfile(**user_doc)

# User endpoints
@api_router.put("/users/profile", response_model=UserProfile)
async def update_profile(
    first_name: Optional[str] = None,
    last_name: Optional[str] = None,
    bio: Optional[str] = None,
    profile_photo: Optional[str] = None,
    location: Optional[Dict[str, float]] = None,
    user_id: str = Depends(verify_token)
):
    update_data = {}
    if first_name:
        update_data["first_name"] = first_name
    if last_name:
        update_data["last_name"] = last_name
    if bio is not None:
        update_data["bio"] = bio
    if profile_photo:
        update_data["profile_photo"] = profile_photo
    if location:
        update_data["location"] = location
    
    await db.users.update_one({"id": user_id}, {"$set": update_data})
    
    user_doc = await db.users.find_one({"id": user_id})
    return UserProfile(**user_doc)

@api_router.post("/users/verify", response_model=Dict[str, str])
async def submit_verification(
    verification_document: str,
    user_id: str = Depends(verify_token)
):
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"verification_document": verification_document, "is_verified": False}}
    )
    return {"message": "Verification document submitted successfully"}

# Item endpoints
@api_router.post("/items", response_model=Item)
async def create_item(item_data: ItemCreate, user_id: str = Depends(verify_token)):
    item = Item(
        owner_id=user_id,
        **item_data.dict()
    )
    await db.items.insert_one(item.dict())
    return item

@api_router.get("/items", response_model=List[Item])
async def get_items(
    category: Optional[ItemCategory] = None,
    search: Optional[str] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    max_distance: Optional[float] = 50,  # km
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    limit: int = 20,
    skip: int = 0
):
    filter_query = {"is_available": True}
    
    if category:
        filter_query["category"] = category
    
    if search:
        filter_query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
    
    if min_price or max_price:
        price_filter = {}
        if min_price:
            price_filter["$gte"] = min_price
        if max_price:
            price_filter["$lte"] = max_price
        filter_query["price_per_day"] = price_filter
    
    items = await db.items.find(filter_query).skip(skip).limit(limit).to_list(limit)
    return [Item(**item) for item in items]

@api_router.get("/items/{item_id}", response_model=Item)
async def get_item(item_id: str):
    item_doc = await db.items.find_one({"id": item_id})
    if not item_doc:
        raise HTTPException(status_code=404, detail="Item not found")
    return Item(**item_doc)

@api_router.get("/items/user/my-items", response_model=List[Item])
async def get_my_items(user_id: str = Depends(verify_token)):
    items = await db.items.find({"owner_id": user_id}).to_list(100)
    return [Item(**item) for item in items]

# Booking endpoints
@api_router.post("/bookings", response_model=Booking)
async def create_booking(booking_data: BookingCreate, user_id: str = Depends(verify_token)):
    # Get item details
    item_doc = await db.items.find_one({"id": booking_data.item_id})
    if not item_doc:
        raise HTTPException(status_code=404, detail="Item not found")
    
    item = Item(**item_doc)
    
    # Calculate total amount (simplified)
    days = (booking_data.end_date - booking_data.start_date).days
    if days <= 0:
        raise HTTPException(status_code=400, detail="Invalid date range")
    
    total_amount = item.price_per_day * days
    deposit_amount = total_amount * 0.2  # 20% deposit
    
    booking = Booking(
        item_id=booking_data.item_id,
        renter_id=user_id,
        owner_id=item.owner_id,
        start_date=booking_data.start_date,
        end_date=booking_data.end_date,
        total_amount=total_amount,
        deposit_amount=deposit_amount,
        notes=booking_data.notes,
        payment_id=f"mock_payment_{uuid.uuid4()}"  # Mock payment
    )
    
    await db.bookings.insert_one(booking.dict())
    return booking

@api_router.get("/bookings/my-bookings", response_model=List[Booking])
async def get_my_bookings(user_id: str = Depends(verify_token)):
    bookings = await db.bookings.find({
        "$or": [
            {"renter_id": user_id},
            {"owner_id": user_id}
        ]
    }).to_list(100)
    return [Booking(**booking) for booking in bookings]

class BookingStatusUpdate(BaseModel):
    status: BookingStatus

@api_router.put("/bookings/{booking_id}/status", response_model=Booking)
async def update_booking_status(
    booking_id: str,
    status_update: BookingStatusUpdate,
    user_id: str = Depends(verify_token)
):
    booking_doc = await db.bookings.find_one({"id": booking_id})
    if not booking_doc:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    booking = Booking(**booking_doc)
    
    # Check permissions
    if booking.owner_id != user_id and booking.renter_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Only owner can approve/reject
    if status_update.status in [BookingStatus.APPROVED, BookingStatus.REJECTED] and booking.owner_id != user_id:
        raise HTTPException(status_code=403, detail="Only owner can approve/reject bookings")
    
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {"status": status_update.status, "updated_at": datetime.utcnow()}}
    )
    
    updated_booking = await db.bookings.find_one({"id": booking_id})
    return Booking(**updated_booking)

@api_router.post("/bookings/{booking_id}/damage-photos", response_model=Dict[str, str])
async def upload_damage_photos(
    booking_id: str,
    photos: List[str],
    photo_type: str,  # "before" or "after"
    user_id: str = Depends(verify_token)
):
    booking_doc = await db.bookings.find_one({"id": booking_id})
    if not booking_doc:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    booking = Booking(**booking_doc)
    
    if booking.renter_id != user_id and booking.owner_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    field_name = "damage_photos_before" if photo_type == "before" else "damage_photos_after"
    
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {field_name: photos, "updated_at": datetime.utcnow()}}
    )
    
    return {"message": f"Damage photos ({photo_type}) uploaded successfully"}

# Review endpoints
@api_router.post("/reviews", response_model=Review)
async def create_review(review_data: ReviewCreate, user_id: str = Depends(verify_token)):
    # Verify booking exists and user is involved
    booking_doc = await db.bookings.find_one({"id": review_data.booking_id})
    if not booking_doc:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    booking = Booking(**booking_doc)
    if booking.renter_id != user_id and booking.owner_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to review this booking")
    
    review = Review(
        reviewer_id=user_id,
        **review_data.dict()
    )
    
    await db.reviews.insert_one(review.dict())
    
    # Update average rating
    if review_data.reviewed_type == "user":
        reviews = await db.reviews.find({
            "reviewed_id": review_data.reviewed_id,
            "reviewed_type": "user"
        }).to_list(1000)
        
        avg_rating = sum(r["rating"] for r in reviews) / len(reviews)
        await db.users.update_one(
            {"id": review_data.reviewed_id},
            {"$set": {"rating": avg_rating, "total_reviews": len(reviews)}}
        )
    
    elif review_data.reviewed_type == "item":
        reviews = await db.reviews.find({
            "reviewed_id": review_data.reviewed_id,
            "reviewed_type": "item"
        }).to_list(1000)
        
        avg_rating = sum(r["rating"] for r in reviews) / len(reviews)
        await db.items.update_one(
            {"id": review_data.reviewed_id},
            {"$set": {"rating": avg_rating, "total_reviews": len(reviews)}}
        )
    
    return review

@api_router.get("/reviews/{reviewed_id}", response_model=List[Review])
async def get_reviews(reviewed_id: str, reviewed_type: str):
    reviews = await db.reviews.find({
        "reviewed_id": reviewed_id,
        "reviewed_type": reviewed_type
    }).to_list(100)
    return [Review(**review) for review in reviews]

# Search and discovery
@api_router.get("/search/popular", response_model=List[Item])
async def get_popular_items(limit: int = 10):
    items = await db.items.find({"is_available": True}).sort("rating", -1).limit(limit).to_list(limit)
    return [Item(**item) for item in items]

@api_router.get("/categories", response_model=List[str])
async def get_categories():
    return [category.value for category in ItemCategory]

# Mock payment endpoint
@api_router.post("/payments/process", response_model=Dict[str, Any])
async def process_payment(
    booking_id: str,
    payment_method: str,
    user_id: str = Depends(verify_token)
):
    # Mock payment processing
    payment_id = f"iyzico_mock_{uuid.uuid4()}"
    
    return {
        "payment_id": payment_id,
        "status": "success",
        "message": "Payment processed successfully (Mock)",
        "booking_id": booking_id
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()