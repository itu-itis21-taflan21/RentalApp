import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Image,
  Alert,
  Modal,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import DateTimePicker from 'react-native-modal-datetime-picker';
import axios from 'axios';

interface Item {
  id: string;
  title: string;
  description: string;
  category: string;
  photos: string[];
  price_per_day: number;
  price_per_hour?: number;
  location: { lat: number; lng: number };
  address: string;
  rating: number;
  total_reviews: number;
  owner_id: string;
  availability_calendar: string[];
  is_available: boolean;
}

interface Review {
  id: string;
  reviewer_id: string;
  rating: number;
  comment: string;
  created_at: string;
  reviewer_name?: string;
}

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const { width } = Dimensions.get('window');

export default function ItemDetailsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const { item } = route.params as { item: Item };

  const [showBookingModal, setShowBookingModal] = useState(false);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const isOwner = user?.id === item.owner_id;

  const handleBookItem = async () => {
    if (!startDate || !endDate) {
      Alert.alert('Error', 'Please select both start and end dates');
      return;
    }

    if (startDate >= endDate) {
      Alert.alert('Error', 'End date must be after start date');
      return;
    }

    setLoading(true);
    try {
      const bookingData = {
        item_id: item.id,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      };

      await axios.post(`${API_URL}/api/bookings`, bookingData);
      setShowBookingModal(false);
      Alert.alert(
        'Booking Request Sent',
        'Your booking request has been sent to the owner. You will be notified once it is approved.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Error booking item:', error);
      Alert.alert('Error', 'Failed to book item. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchReviews = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/reviews/${item.id}?reviewed_type=item`);
      setReviews(response.data);
    } catch (error) {
      console.error('Error fetching reviews:', error);
    }
  };

  React.useEffect(() => {
    fetchReviews();
  }, []);

  const calculateTotal = () => {
    if (!startDate || !endDate) return 0;
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    return days * item.price_per_day;
  };

  const renderStars = (rating: number, size = 16) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Ionicons
          key={i}
          name={i <= rating ? 'star' : 'star-outline'}
          size={size}
          color="#FFD700"
        />
      );
    }
    return stars;
  };

  const ImageCarousel = () => (
    <View style={styles.imageCarouselContainer}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={(e) => {
          const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
          setCurrentImageIndex(newIndex);
        }}
        scrollEventThrottle={16}
      >
        {item.photos && item.photos.length > 0 ? (
          item.photos.map((photo, index) => (
            <Image
              key={index}
              source={{ uri: `data:image/jpeg;base64,${photo}` }}
              style={styles.carouselImage}
            />
          ))
        ) : (
          <View style={[styles.carouselImage, styles.placeholderImage]}>
            <Ionicons name="image-outline" size={80} color="#ccc" />
          </View>
        )}
      </ScrollView>

      {item.photos && item.photos.length > 1 && (
        <View style={styles.imageIndicators}>
          {item.photos.map((_, index) => (
            <View
              key={index}
              style={[
                styles.indicator,
                index === currentImageIndex && styles.activeIndicator,
              ]}
            />
          ))}
        </View>
      )}

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="arrow-back" size={24} color="white" />
      </TouchableOpacity>

      <View style={styles.categoryBadge}>
        <Text style={styles.categoryText}>{item.category}</Text>
      </View>
    </View>
  );

  const BookingModal = () => (
    <Modal
      visible={showBookingModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowBookingModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.bookingModal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowBookingModal(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Book Item</Text>
            <TouchableOpacity onPress={handleBookItem} disabled={loading}>
              <Text style={[styles.modalBookText, loading && styles.modalBookTextDisabled]}>
                {loading ? 'Booking...' : 'Book'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <View style={styles.dateSection}>
              <Text style={styles.sectionTitle}>Select Dates</Text>
              
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowStartDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={20} color="#007AFF" />
                <Text style={styles.dateButtonText}>
                  Start Date: {startDate ? startDate.toLocaleDateString() : 'Select'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowEndDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={20} color="#007AFF" />
                <Text style={styles.dateButtonText}>
                  End Date: {endDate ? endDate.toLocaleDateString() : 'Select'}
                </Text>
              </TouchableOpacity>
            </View>

            {startDate && endDate && (
              <View style={styles.priceBreakdown}>
                <Text style={styles.sectionTitle}>Price Breakdown</Text>
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>
                    ${item.price_per_day}/day × {Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))} days
                  </Text>
                  <Text style={styles.priceValue}>${calculateTotal()}</Text>
                </View>
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Deposit (20%)</Text>
                  <Text style={styles.priceValue}>${(calculateTotal() * 0.2).toFixed(2)}</Text>
                </View>
                <View style={[styles.priceRow, styles.totalRow]}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>${calculateTotal()}</Text>
                </View>
              </View>
            )}
          </View>

          <DateTimePicker
            isVisible={showStartDatePicker}
            mode="date"
            onConfirm={(date) => {
              setStartDate(date);
              setShowStartDatePicker(false);
            }}
            onCancel={() => setShowStartDatePicker(false)}
            minimumDate={new Date()}
          />

          <DateTimePicker
            isVisible={showEndDatePicker}
            mode="date"
            onConfirm={(date) => {
              setEndDate(date);
              setShowEndDatePicker(false);
            }}
            onCancel={() => setShowEndDatePicker(false)}
            minimumDate={startDate || new Date()}
          />
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <ImageCarousel />

        <View style={styles.content}>
          {/* Item Info */}
          <View style={styles.itemHeader}>
            <Text style={styles.itemTitle}>{item.title}</Text>
            <View style={styles.ratingContainer}>
              <View style={styles.stars}>
                {renderStars(item.rating)}
              </View>
              <Text style={styles.reviewCount}>
                ({item.total_reviews} reviews)
              </Text>
            </View>
          </View>

          <View style={styles.priceContainer}>
            <Text style={styles.price}>${item.price_per_day}</Text>
            <Text style={styles.priceUnit}>per day</Text>
            {item.price_per_hour && (
              <Text style={styles.hourlyPrice}>
                or ${item.price_per_hour}/hour
              </Text>
            )}
          </View>

          <View style={styles.locationContainer}>
            <Ionicons name="location-outline" size={16} color="#666" />
            <Text style={styles.locationText}>{item.address}</Text>
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{item.description}</Text>
          </View>

          {/* Availability */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Availability</Text>
            <View style={styles.availabilityContainer}>
              <Ionicons
                name={item.is_available ? 'checkmark-circle' : 'close-circle'}
                size={20}
                color={item.is_available ? '#34C759' : '#FF3B30'}
              />
              <Text
                style={[
                  styles.availabilityText,
                  { color: item.is_available ? '#34C759' : '#FF3B30' },
                ]}
              >
                {item.is_available ? 'Available for rent' : 'Currently unavailable'}
              </Text>
            </View>
          </View>

          {/* Reviews */}
          <View style={styles.section}>
            <View style={styles.reviewsHeader}>
              <Text style={styles.sectionTitle}>
                Reviews ({reviews.length})
              </Text>
              <View style={styles.overallRating}>
                <View style={styles.stars}>
                  {renderStars(item.rating)}
                </View>
                <Text style={styles.ratingNumber}>{item.rating.toFixed(1)}</Text>
              </View>
            </View>

            {reviews.length > 0 ? (
              reviews.slice(0, 3).map((review) => (
                <View key={review.id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewerInfo}>
                      <View style={styles.reviewerAvatar}>
                        <Text style={styles.reviewerInitial}>
                          {review.reviewer_name?.charAt(0) || 'U'}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.reviewerName}>
                          {review.reviewer_name || 'User'}
                        </Text>
                        <View style={styles.stars}>
                          {renderStars(review.rating, 12)}
                        </View>
                      </View>
                    </View>
                    <Text style={styles.reviewDate}>
                      {new Date(review.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  {review.comment && (
                    <Text style={styles.reviewComment}>{review.comment}</Text>
                  )}
                </View>
              ))
            ) : (
              <Text style={styles.noReviewsText}>No reviews yet</Text>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      {!isOwner && item.is_available && (
        <View style={styles.bottomBar}>
          <View style={styles.priceInfo}>
            <Text style={styles.bottomPrice}>${item.price_per_day}</Text>
            <Text style={styles.bottomPriceUnit}>per day</Text>
          </View>
          <TouchableOpacity
            style={styles.bookButton}
            onPress={() => setShowBookingModal(true)}
          >
            <Text style={styles.bookButtonText}>Book Now</Text>
          </TouchableOpacity>
        </View>
      )}

      {isOwner && (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => Alert.alert('Coming Soon', 'Edit item functionality will be available soon')}
          >
            <Ionicons name="create-outline" size={20} color="#007AFF" />
            <Text style={styles.editButtonText}>Edit Item</Text>
          </TouchableOpacity>
        </View>
      )}

      <BookingModal />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  scrollView: {
    flex: 1,
  },
  imageCarouselContainer: {
    position: 'relative',
    height: 300,
  },
  carouselImage: {
    width: width,
    height: 300,
  },
  placeholderImage: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageIndicators: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 4,
  },
  activeIndicator: {
    backgroundColor: 'white',
  },
  backButton: {
    position: 'absolute',
    top: 44,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryBadge: {
    position: 'absolute',
    top: 44,
    right: 16,
    backgroundColor: 'rgba(0, 122, 255, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  categoryText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  content: {
    padding: 20,
  },
  itemHeader: {
    marginBottom: 12,
  },
  itemTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stars: {
    flexDirection: 'row',
    marginRight: 8,
  },
  reviewCount: {
    fontSize: 14,
    color: '#666',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  price: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  priceUnit: {
    fontSize: 16,
    color: '#666',
    marginLeft: 4,
  },
  hourlyPrice: {
    fontSize: 14,
    color: '#666',
    marginLeft: 12,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  locationText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
  availabilityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  availabilityText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  reviewsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  overallRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  reviewCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  reviewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  reviewerInitial: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  reviewDate: {
    fontSize: 12,
    color: '#666',
  },
  reviewComment: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  noReviewsText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  priceInfo: {
    flex: 1,
  },
  bottomPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  bottomPriceUnit: {
    fontSize: 14,
    color: '#666',
  },
  bookButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  bookButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingVertical: 12,
    borderRadius: 8,
  },
  editButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  bookingModal: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#666',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBookText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  modalBookTextDisabled: {
    color: '#ccc',
  },
  modalContent: {
    padding: 20,
  },
  dateSection: {
    marginBottom: 24,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginBottom: 12,
  },
  dateButtonText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  priceBreakdown: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceLabel: {
    fontSize: 14,
    color: '#666',
  },
  priceValue: {
    fontSize: 14,
    color: '#333',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    paddingTop: 12,
    marginTop: 8,
    marginBottom: 0,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
});