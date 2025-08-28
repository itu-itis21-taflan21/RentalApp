import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Image,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

interface Booking {
  id: string;
  item_id: string;
  renter_id: string;
  owner_id: string;
  start_date: string;
  end_date: string;
  total_amount: number;
  deposit_amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'active' | 'completed' | 'disputed';
  payment_id?: string;
  notes?: string;
  created_at: string;
}

interface Item {
  id: string;
  title: string;
  description: string;
  category: string;
  photos: string[];
  price_per_day: number;
  owner_id: string;
}

interface BookingWithItem extends Booking {
  item?: Item;
  isOwner: boolean;
}

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function MyRentalsScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [bookings, setBookings] = useState<BookingWithItem[]>([]);
  const [activeTab, setActiveTab] = useState<'renting' | 'lending'>('renting');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/bookings/my-bookings`);
      const bookingsData = response.data;

      // Fetch item details for each booking
      const bookingsWithItems = await Promise.all(
        bookingsData.map(async (booking: Booking) => {
          try {
            const itemResponse = await axios.get(`${API_URL}/api/items/${booking.item_id}`);
            return {
              ...booking,
              item: itemResponse.data,
              isOwner: booking.owner_id === user?.id,
            };
          } catch (error) {
            return {
              ...booking,
              isOwner: booking.owner_id === user?.id,
            };
          }
        })
      );

      setBookings(bookingsWithItems);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      Alert.alert('Error', 'Failed to load bookings. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchBookings();
  };

  const handleBookingAction = async (bookingId: string, action: string) => {
    try {
      let status;
      switch (action) {
        case 'approve':
          status = 'approved';
          break;
        case 'reject':
          status = 'rejected';
          break;
        case 'complete':
          status = 'completed';
          break;
        default:
          return;
      }

      await axios.put(`${API_URL}/api/bookings/${bookingId}/status`, { status });
      fetchBookings();
      Alert.alert('Success', `Booking ${action}d successfully`);
    } catch (error) {
      console.error(`Error ${action}ing booking:`, error);
      Alert.alert('Error', `Failed to ${action} booking. Please try again.`);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#FF9500';
      case 'approved':
        return '#007AFF';
      case 'active':
        return '#34C759';
      case 'completed':
        return '#8E8E93';
      case 'rejected':
      case 'disputed':
        return '#FF3B30';
      default:
        return '#8E8E93';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return 'time-outline';
      case 'approved':
        return 'checkmark-circle-outline';
      case 'active':
        return 'play-circle-outline';
      case 'completed':
        return 'checkmark-done-outline';
      case 'rejected':
        return 'close-circle-outline';
      case 'disputed':
        return 'warning-outline';
      default:
        return 'help-circle-outline';
    }
  };

  const filteredBookings = bookings.filter((booking) => {
    if (activeTab === 'renting') {
      return booking.renter_id === user?.id;
    } else {
      return booking.owner_id === user?.id;
    }
  });

  const renderBookingCard = (booking: BookingWithItem) => (
    <TouchableOpacity
      key={booking.id}
      style={styles.bookingCard}
      onPress={() => navigation.navigate('BookingDetails', { booking })}
    >
      <View style={styles.bookingHeader}>
        <View style={styles.itemInfo}>
          {booking.item?.photos && booking.item.photos.length > 0 ? (
            <Image
              source={{ uri: `data:image/jpeg;base64,${booking.item.photos[0]}` }}
              style={styles.itemImage}
            />
          ) : (
            <View style={[styles.itemImage, styles.placeholderImage]}>
              <Ionicons name="image-outline" size={24} color="#ccc" />
            </View>
          )}
          <View style={styles.itemDetails}>
            <Text style={styles.itemTitle} numberOfLines={1}>
              {booking.item?.title || 'Unknown Item'}
            </Text>
            <Text style={styles.itemCategory}>
              {booking.item?.category || 'Unknown'}
            </Text>
            <View style={styles.dateContainer}>
              <Ionicons name="calendar-outline" size={14} color="#666" />
              <Text style={styles.dateText}>
                {new Date(booking.start_date).toLocaleDateString()} - {' '}
                {new Date(booking.end_date).toLocaleDateString()}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.statusContainer}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) }]}>
            <Ionicons
              name={getStatusIcon(booking.status) as any}
              size={16}
              color="white"
            />
            <Text style={styles.statusText}>
              {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.bookingFooter}>
        <View style={styles.priceInfo}>
          <Text style={styles.totalAmount}>${booking.total_amount}</Text>
          <Text style={styles.priceLabel}>Total</Text>
        </View>

        {booking.isOwner && booking.status === 'pending' && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              onPress={() => handleBookingAction(booking.id, 'reject')}
            >
              <Text style={styles.rejectButtonText}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.approveButton]}
              onPress={() => handleBookingAction(booking.id, 'approve')}
            >
              <Text style={styles.approveButtonText}>Approve</Text>
            </TouchableOpacity>
          </View>
        )}

        {booking.isOwner && booking.status === 'active' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.completeButton]}
            onPress={() => handleBookingAction(booking.id, 'complete')}
          >
            <Text style={styles.completeButtonText}>Mark Complete</Text>
          </TouchableOpacity>
        )}
      </View>

      {booking.notes && (
        <View style={styles.notesContainer}>
          <Text style={styles.notesLabel}>Notes:</Text>
          <Text style={styles.notesText}>{booking.notes}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Rentals</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('CreateListing')}
        >
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'renting' && styles.activeTab]}
          onPress={() => setActiveTab('renting')}
        >
          <Text style={[styles.tabText, activeTab === 'renting' && styles.activeTabText]}>
            Renting
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'lending' && styles.activeTab]}
          onPress={() => setActiveTab('lending')}
        >
          <Text style={[styles.tabText, activeTab === 'lending' && styles.activeTabText]}>
            Lending
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredBookings.length > 0 ? (
          <View style={styles.bookingsContainer}>
            {filteredBookings.map((booking) => renderBookingCard(booking))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons
              name={activeTab === 'renting' ? 'bag-outline' : 'storefront-outline'}
              size={64}
              color="#ccc"
            />
            <Text style={styles.emptyStateTitle}>
              {activeTab === 'renting' ? 'No Rentals' : 'No Lending'}
            </Text>
            <Text style={styles.emptyStateText}>
              {activeTab === 'renting'
                ? 'You haven\'t rented anything yet'
                : 'You haven\'t lent anything yet'}
            </Text>
            <TouchableOpacity
              style={styles.emptyStateButton}
              onPress={() => {
                if (activeTab === 'renting') {
                  navigation.navigate('Search');
                } else {
                  navigation.navigate('CreateListing');
                }
              }}
            >
              <Text style={styles.emptyStateButtonText}>
                {activeTab === 'renting' ? 'Browse Items' : 'Create Listing'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    backgroundColor: '#007AFF',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 16,
    color: '#666',
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  bookingsContainer: {
    padding: 20,
  },
  bookingCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  itemInfo: {
    flex: 1,
    flexDirection: 'row',
    marginRight: 12,
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  placeholderImage: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemDetails: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  itemCategory: {
    fontSize: 14,
    color: '#666',
    textTransform: 'capitalize',
    marginBottom: 4,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  bookingFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceInfo: {
    alignItems: 'flex-start',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  priceLabel: {
    fontSize: 12,
    color: '#666',
  },
  actionButtons: {
    flexDirection: 'row',
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  rejectButton: {
    backgroundColor: '#ffebee',
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  approveButton: {
    backgroundColor: '#007AFF',
  },
  completeButton: {
    backgroundColor: '#34C759',
  },
  rejectButtonText: {
    color: '#d32f2f',
    fontSize: 14,
    fontWeight: '600',
  },
  approveButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  completeButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  notesContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  notesLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    color: '#333',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  emptyStateButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  emptyStateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});