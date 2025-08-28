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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import * as ImagePicker from 'expo-image-picker';
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
  damage_photos_before: string[];
  damage_photos_after: string[];
  created_at: string;
  item?: {
    id: string;
    title: string;
    photos: string[];
    category: string;
    address: string;
  };
  isOwner: boolean;
}

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function BookingDetailsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const { booking: initialBooking } = route.params as { booking: Booking };

  const [booking, setBooking] = useState<Booking>(initialBooking);
  const [loading, setLoading] = useState(false);

  const isOwner = booking.owner_id === user?.id;
  const isRenter = booking.renter_id === user?.id;

  const handleStatusUpdate = async (newStatus: string) => {
    setLoading(true);
    try {
      await axios.put(`${API_URL}/api/bookings/${booking.id}/status`, { status: newStatus });
      setBooking(prev => ({ ...prev, status: newStatus as any }));
      Alert.alert('Success', `Booking ${newStatus} successfully`);
    } catch (error) {
      console.error('Error updating booking status:', error);
      Alert.alert('Error', 'Failed to update booking status. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadDamagePhotos = async (photoType: 'before' | 'after') => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Sorry, we need camera roll permissions to make this work!');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
        allowsMultipleSelection: true,
      });

      if (!result.canceled && result.assets.length > 0) {
        const base64Images = result.assets
          .map(asset => asset.base64)
          .filter((base64): base64 is string => base64 !== null);

        if (base64Images.length > 0) {
          setLoading(true);
          try {
            await axios.post(`${API_URL}/api/bookings/${booking.id}/damage-photos`, {
              photos: base64Images,
              photo_type: photoType,
            });

            // Update local state
            setBooking(prev => ({
              ...prev,
              [photoType === 'before' ? 'damage_photos_before' : 'damage_photos_after']: base64Images,
            }));

            Alert.alert('Success', 'Damage photos uploaded successfully');
          } catch (error) {
            console.error('Error uploading damage photos:', error);
            Alert.alert('Error', 'Failed to upload photos. Please try again.');
          } finally {
            setLoading(false);
          }
        }
      }
    } catch (error) {
      console.error('Error picking images:', error);
      Alert.alert('Error', 'Failed to pick images. Please try again.');
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

  const renderDamagePhotos = (photos: string[], title: string) => {
    if (!photos || photos.length === 0) {
      return (
        <View style={styles.noPhotosContainer}>
          <Ionicons name="image-outline" size={32} color="#ccc" />
          <Text style={styles.noPhotosText}>No photos uploaded</Text>
        </View>
      );
    }

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosScroll}>
        {photos.map((photo, index) => (
          <Image
            key={index}
            source={{ uri: `data:image/jpeg;base64,${photo}` }}
            style={styles.damagePhoto}
          />
        ))}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking Details</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Status Section */}
        <View style={styles.section}>
          <View style={styles.statusHeader}>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) }]}>
              <Ionicons
                name={getStatusIcon(booking.status) as any}
                size={20}
                color="white"
              />
              <Text style={styles.statusText}>
                {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
              </Text>
            </View>
          </View>
        </View>

        {/* Item Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Item Details</Text>
          <View style={styles.itemContainer}>
            {booking.item?.photos && booking.item.photos.length > 0 ? (
              <Image
                source={{ uri: `data:image/jpeg;base64,${booking.item.photos[0]}` }}
                style={styles.itemImage}
              />
            ) : (
              <View style={[styles.itemImage, styles.placeholderImage]}>
                <Ionicons name="image-outline" size={32} color="#ccc" />
              </View>
            )}
            <View style={styles.itemDetails}>
              <Text style={styles.itemTitle}>{booking.item?.title || 'Unknown Item'}</Text>
              <Text style={styles.itemCategory}>{booking.item?.category || 'Unknown'}</Text>
              <Text style={styles.itemAddress} numberOfLines={2}>
                <Ionicons name="location-outline" size={14} color="#666" />
                {' ' + (booking.item?.address || 'Address not available')}
              </Text>
            </View>
          </View>
        </View>

        {/* Booking Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Booking Information</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Booking ID:</Text>
            <Text style={styles.infoValue}>{booking.id}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Start Date:</Text>
            <Text style={styles.infoValue}>
              {new Date(booking.start_date).toLocaleDateString()}
            </Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>End Date:</Text>
            <Text style={styles.infoValue}>
              {new Date(booking.end_date).toLocaleDateString()}
            </Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Duration:</Text>
            <Text style={styles.infoValue}>
              {Math.ceil(
                (new Date(booking.end_date).getTime() - new Date(booking.start_date).getTime()) /
                (1000 * 60 * 60 * 24)
              )} days
            </Text>
          </View>

          {booking.notes && (
            <View style={styles.notesContainer}>
              <Text style={styles.infoLabel}>Notes:</Text>
              <Text style={styles.notesText}>{booking.notes}</Text>
            </View>
          )}
        </View>

        {/* Payment Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Information</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Total Amount:</Text>
            <Text style={styles.priceValue}>${booking.total_amount}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Deposit:</Text>
            <Text style={styles.priceValue}>${booking.deposit_amount}</Text>
          </View>
          
          {booking.payment_id && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Payment ID:</Text>
              <Text style={styles.infoValue}>{booking.payment_id}</Text>
            </View>
          )}
        </View>

        {/* Damage Documentation */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Damage Documentation</Text>
          
          <View style={styles.damageSection}>
            <View style={styles.damageSectionHeader}>
              <Text style={styles.damageSectionTitle}>Before Handover</Text>
              {(isOwner || isRenter) && booking.status === 'approved' && (
                <TouchableOpacity
                  style={styles.uploadButton}
                  onPress={() => handleUploadDamagePhotos('before')}
                  disabled={loading}
                >
                  <Ionicons name="camera" size={16} color="#007AFF" />
                  <Text style={styles.uploadButtonText}>Upload</Text>
                </TouchableOpacity>
              )}
            </View>
            {renderDamagePhotos(booking.damage_photos_before, 'Before Photos')}
          </View>

          <View style={styles.damageSection}>
            <View style={styles.damageSectionHeader}>
              <Text style={styles.damageSectionTitle}>After Return</Text>
              {(isOwner || isRenter) && booking.status === 'active' && (
                <TouchableOpacity
                  style={styles.uploadButton}
                  onPress={() => handleUploadDamagePhotos('after')}
                  disabled={loading}
                >
                  <Ionicons name="camera" size={16} color="#007AFF" />
                  <Text style={styles.uploadButtonText}>Upload</Text>
                </TouchableOpacity>
              )}
            </View>
            {renderDamagePhotos(booking.damage_photos_after, 'After Photos')}
          </View>
        </View>

        {/* Actions */}
        {isOwner && booking.status === 'pending' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Actions</Text>
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, styles.rejectButton]}
                onPress={() => handleStatusUpdate('rejected')}
                disabled={loading}
              >
                <Text style={styles.rejectButtonText}>Reject Booking</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.approveButton]}
                onPress={() => handleStatusUpdate('approved')}
                disabled={loading}
              >
                <Text style={styles.approveButtonText}>Approve Booking</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {isOwner && booking.status === 'active' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Actions</Text>
            <TouchableOpacity
              style={[styles.actionButton, styles.completeButton]}
              onPress={() => handleStatusUpdate('completed')}
              disabled={loading}
            >
              <Text style={styles.completeButtonText}>Mark as Completed</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.bottomPadding} />
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    backgroundColor: 'white',
    marginBottom: 12,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  statusHeader: {
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  itemContainer: {
    flexDirection: 'row',
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 16,
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
    color: '#007AFF',
    textTransform: 'capitalize',
    marginBottom: 8,
  },
  itemAddress: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    textAlign: 'right',
    flex: 1,
  },
  priceValue: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: 'bold',
    textAlign: 'right',
    flex: 1,
  },
  notesContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  notesText: {
    fontSize: 14,
    color: '#333',
    marginTop: 4,
    lineHeight: 20,
  },
  damageSection: {
    marginBottom: 20,
  },
  damageSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  damageSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f0f8ff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  uploadButtonText: {
    color: '#007AFF',
    fontSize: 14,
    marginLeft: 4,
  },
  photosScroll: {
    marginTop: 8,
  },
  damagePhoto: {
    width: 100,
    height: 100,
    borderRadius: 8,
    marginRight: 12,
  },
  noPhotosContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
    borderStyle: 'dashed',
  },
  noPhotosText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  rejectButton: {
    backgroundColor: '#ffebee',
    borderWidth: 1,
    borderColor: '#ffcdd2',
    marginRight: 8,
  },
  approveButton: {
    backgroundColor: '#007AFF',
    marginLeft: 8,
  },
  completeButton: {
    backgroundColor: '#34C759',
  },
  rejectButtonText: {
    color: '#d32f2f',
    fontSize: 16,
    fontWeight: '600',
  },
  approveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  completeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomPadding: {
    height: 20,
  },
});