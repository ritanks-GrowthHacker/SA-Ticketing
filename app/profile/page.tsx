'use client';

import React, { useState, useEffect } from 'react';
import { Camera, Mail, Phone, MapPin, Calendar, Edit3, Save, X, User, Briefcase, Building } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { UserProfile, UpdateProfileRequest } from '../../db/types';
import PasswordChangeModal from '../../components/modals/PasswordChangeModal';
import { AttendanceCheckInOut } from '@/components/AttendanceCheckInOut';

const Profile = () => {
  const { token, organization, roles } = useAuthStore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingAbout, setIsEditingAbout] = useState(false);
  const [formData, setFormData] = useState<UpdateProfileRequest>({});
  const [aboutText, setAboutText] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  
  // File input ref for image upload
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Fetch user profile
  const fetchProfile = async () => {
    if (!token) return;
    
    try {
      const response = await fetch('/api/get-user-profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setProfile(data.profile);
        setAboutText(data.profile.about || '');
        setEmailNotifications(data.profile.emailNotificationsEnabled ?? true);
        setDarkMode(data.profile.darkModeEnabled ?? false);
        setFormData({
          name: data.profile.name,
          email: data.profile.email,
          phone: data.profile.phone,
          location: data.profile.location,
          jobTitle: data.profile.jobTitle,
          department: data.profile.department,
          dateOfBirth: data.profile.dateOfBirth,
        });
      } else {
        setError('Failed to load profile');
      }
    } catch (err) {
      setError('Error loading profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [token]);

  // Apply dark mode on component mount and when darkMode changes
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Update profile
  const handleSave = async () => {
    if (!token) return;
    
    try {
      const response = await fetch('/api/update-user-profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const data = await response.json();
        setProfile(data.profile);
        setSuccess('Profile updated successfully');
        setIsEditing(false);
        setError('');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to update profile');
      }
    } catch (err) {
      setError('Error updating profile');
    }
  };

  // Update about section
  const handleSaveAbout = async () => {
    if (!token) return;
    
    try {
      const response = await fetch('/api/update-user-profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ about: aboutText })
      });

      if (response.ok) {
        const data = await response.json();
        setProfile(data.profile);
        setSuccess('About section updated successfully');
        setIsEditingAbout(false);
        setError('');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to update about section');
      }
    } catch (err) {
      setError('Error updating about section');
    }
  };

  // Handle input changes
  const handleInputChange = (field: keyof UpdateProfileRequest, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle email notifications toggle
  const handleEmailNotificationsToggle = async (enabled: boolean) => {
    if (!token) return;
    
    try {
      const response = await fetch('/api/update-user-profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ emailNotificationsEnabled: enabled })
      });

      if (response.ok) {
        const data = await response.json();
        setProfile(data.profile);
        setEmailNotifications(enabled);
        setSuccess(`Email notifications ${enabled ? 'enabled' : 'disabled'}`);
        setTimeout(() => setSuccess(''), 3000);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to update notification settings');
      }
    } catch (err) {
      setError('Error updating notification settings');
    }
  };

  // Handle dark mode toggle
  const handleDarkModeToggle = async (enabled: boolean) => {
    if (!token) return;
    
    try {
      const response = await fetch('/api/update-user-profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ darkModeEnabled: enabled })
      });

      if (response.ok) {
        const data = await response.json();
        setProfile(data.profile);
        setDarkMode(enabled);
        
        // Apply dark mode to document
        if (enabled) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        
        setSuccess(`Dark mode ${enabled ? 'enabled' : 'disabled'}`);
        setTimeout(() => setSuccess(''), 3000);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to update dark mode settings');
      }
    } catch (err) {
      setError('Error updating dark mode settings');
    }
  };

  // Handle image upload button click
  const handleImageUploadClick = () => {
    fileInputRef.current?.click();
  };

  // Compress and resize image with aggressive compression for database storage
  const compressImage = (file: File, maxWidth: number = 200, quality: number = 0.6): Promise<string> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Calculate new dimensions maintaining aspect ratio - smaller for database
        const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
        const newWidth = img.width * ratio;
        const newHeight = img.height * ratio;
        
        canvas.width = newWidth;
        canvas.height = newHeight;

        // Draw and compress with lower quality for smaller file size
        ctx?.drawImage(img, 0, 0, newWidth, newHeight);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        
        // Check if still too large (approximate base64 size check)
        if (compressedDataUrl.length > 8000) { // Conservative limit
          // Try again with even smaller dimensions and lower quality
          canvas.width = newWidth * 0.7;
          canvas.height = newHeight * 0.7;
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          const superCompressed = canvas.toDataURL('image/jpeg', 0.4);
          resolve(superCompressed);
        } else {
          resolve(compressedDataUrl);
        }
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  };

  // Handle image file selection
  const handleImageFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (JPG, PNG, GIF, etc.)');
      return;
    }

    // Validate file size (max 10MB for original)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image size must be less than 10MB');
      return;
    }

    setImageUploading(true);
    setError('');
    setSuccess('');

    try {
      // Compress the image aggressively for database storage
      const compressedImage = await compressImage(file, 150, 0.5);
      
      // Check final compressed size (base64 adds ~33% overhead)
      if (compressedImage.length > 8000) {
        setError('Image is still too large after compression. Please try a smaller image.');
        setImageUploading(false);
        return;
      }
      
      console.log(`📸 Compressed image size: ${compressedImage.length} characters`);
      
      // Update profile with the compressed image using dedicated endpoint
      const response = await fetch('/api/upload-profile-image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          imageData: compressedImage 
        })
      });

      if (response.ok) {
        const data = await response.json();
        setProfile(data.profile);
        setSuccess('Profile picture updated successfully! 📸');
        
        // Clear the file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        
        // Auto-hide success message after 3 seconds
        setTimeout(() => setSuccess(''), 3000);
      } else {
        const errorData = await response.json();
        
        if (response.status === 413) {
          setError('Image is too large. Please try a smaller image or lower quality photo.');
        } else {
          setError(errorData.error || 'Failed to update profile picture');
        }
      }
    } catch (err) {
      console.error('Image upload error:', err);
      setError('Error processing or uploading image. Please try again.');
    } finally {
      setImageUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Profile not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
          <p className="text-gray-600 mt-1">Manage your account settings and preferences</p>
        </div>
        <AttendanceCheckInOut />
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800">{success}</p>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-center">
              {/* Avatar */}
              <div className="relative inline-block">
                {profile.profilePicture ? (
                  <img
                    src={profile.profilePicture}
                    alt={profile.name}
                    className={`w-24 h-24 rounded-full object-cover mx-auto transition-opacity ${
                      imageUploading ? 'opacity-50' : 'opacity-100'
                    }`}
                  />
                ) : (
                  <div className={`w-24 h-24 rounded-full bg-blue-600 flex items-center justify-center mx-auto transition-opacity ${
                    imageUploading ? 'opacity-50' : 'opacity-100'
                  }`}>
                    <span className="text-2xl font-bold text-white">
                      {profile.name.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                )}
                
                {/* Upload overlay */}
                {imageUploading && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                    <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
                
                <button 
                  onClick={handleImageUploadClick}
                  disabled={imageUploading}
                  className="absolute bottom-0 right-0 p-2 bg-gray-800 text-white rounded-full hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={imageUploading ? "Uploading..." : "Upload profile picture"}
                >
                  {imageUploading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                </button>
                
                {/* Hidden file input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageFileChange}
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  className="hidden"
                />
              </div>
              
              <h2 className="mt-4 text-xl font-semibold text-gray-900">{profile.name}</h2>
              <p className="text-gray-600">{profile.role || 'Member'}</p>
              {profile.jobTitle && <p className="text-sm text-gray-500">{profile.jobTitle}</p>}
              {profile.department && <p className="text-sm text-gray-500">{profile.department}</p>}
              
              {/* Upload hint */}
              {!imageUploading && (
                <p className="text-xs text-gray-400 mt-2">Click camera icon to upload photo</p>
              )}
            </div>
            
            <div className="mt-6 space-y-3">
              <div className="flex items-center space-x-3 text-sm">
                <Mail className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">{profile.email}</span>
              </div>
              
              {profile.phone && (
                <div className="flex items-center space-x-3 text-sm">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">{profile.phone}</span>
                </div>
              )}
              
              {profile.location && (
                <div className="flex items-center space-x-3 text-sm">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">{profile.location}</span>
                </div>
              )}
              
              <div className="flex items-center space-x-3 text-sm">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">Joined {new Date(profile.createdAt).toLocaleDateString()}</span>
              </div>
              
              {organization && (
                <div className="flex items-center space-x-3 text-sm">
                  <Building className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">{organization.name}</span>
                </div>
              )}
            </div>
            
            <button 
              onClick={() => setIsEditing(!isEditing)}
              className="w-full mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
            >
              <Edit3 className="w-4 h-4" />
              <span>{isEditing ? 'Cancel Edit' : 'Edit Profile'}</span>
            </button>
          </div>
        </div>

        {/* Profile Settings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Information */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Personal Information</h3>
              {isEditing && (
                <div className="flex space-x-2">
                  <button 
                    onClick={handleSave}
                    className="text-green-600 hover:text-green-800 font-medium text-sm flex items-center space-x-1"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save</span>
                  </button>
                  <button 
                    onClick={() => setIsEditing(false)}
                    className="text-gray-600 hover:text-gray-800 font-medium text-sm flex items-center space-x-1"
                  >
                    <X className="w-4 h-4" />
                    <span>Cancel</span>
                  </button>
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  readOnly={!isEditing}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  readOnly={!isEditing}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={formData.phone || ''}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="Enter phone number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  readOnly={!isEditing}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  value={formData.location || ''}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  placeholder="Enter location"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  readOnly={!isEditing}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Job Title
                </label>
                <input
                  type="text"
                  value={formData.jobTitle || ''}
                  onChange={(e) => handleInputChange('jobTitle', e.target.value)}
                  placeholder="Enter job title"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  readOnly={!isEditing}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department
                </label>
                <input
                  type="text"
                  value={formData.department || ''}
                  onChange={(e) => handleInputChange('department', e.target.value)}
                  placeholder="Enter department"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  readOnly={!isEditing}
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={formData.dateOfBirth || ''}
                  onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  readOnly={!isEditing}
                />
              </div>
            </div>
          </div>

          {/* About Section */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">About</h3>
              {isEditingAbout ? (
                <div className="flex space-x-2">
                  <button 
                    onClick={handleSaveAbout}
                    className="text-green-600 hover:text-green-800 font-medium text-sm flex items-center space-x-1"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save</span>
                  </button>
                  <button 
                    onClick={() => {
                      setIsEditingAbout(false);
                      setAboutText(profile.about || '');
                    }}
                    className="text-gray-600 hover:text-gray-800 font-medium text-sm flex items-center space-x-1"
                  >
                    <X className="w-4 h-4" />
                    <span>Cancel</span>
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setIsEditingAbout(true)}
                  className="text-blue-600 hover:text-blue-800 font-medium text-sm flex items-center space-x-1"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>Edit</span>
                </button>
              )}
            </div>
            
            {isEditingAbout ? (
              <textarea
                value={aboutText}
                onChange={(e) => setAboutText(e.target.value)}
                placeholder="Tell us about yourself..."
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            ) : (
              <div className="min-h-24">
                {profile.about ? (
                  <p className="text-gray-700 whitespace-pre-wrap">{profile.about}</p>
                ) : (
                  <p className="text-gray-400 italic">No information provided yet. Click Edit to add your bio.</p>
                )}
              </div>
            )}
          </div>

          {/* Security Settings */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Security Settings</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <h4 className="font-medium text-gray-900">Change Password</h4>
                  <p className="text-sm text-gray-500">Update your password to keep your account secure</p>
                </div>
                <button 
                  onClick={() => setIsPasswordModalOpen(true)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Change
                </button>
              </div>
              
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <h4 className="font-medium text-gray-900">Two-Factor Authentication</h4>
                  <p className="text-sm text-gray-500">Add an extra layer of security to your account</p>
                </div>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  Enable
                </button>
              </div>
            </div>
          </div>

          {/* Preferences */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Preferences</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">Email Notifications</h4>
                  <p className="text-sm text-gray-500">Receive email notifications for important updates</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={Boolean(emailNotifications)}
                    onChange={(e) => handleEmailNotificationsToggle(e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">Dark Mode</h4>
                  <p className="text-sm text-gray-500">Switch to dark theme for better viewing in low light</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={Boolean(darkMode)}
                    onChange={(e) => handleDarkModeToggle(e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PasswordChangeModal 
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        userEmail={profile?.email || ''}
        token={token || ''}
      />
    </div>
  );
};

export default Profile;