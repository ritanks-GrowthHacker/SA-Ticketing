'use client';

import React, { useState } from 'react';
import { Building2, Mail, User, Lock, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface OnboardingFormData {
  organizationName: string;
  domain: string;
  username: string;
  orgEmail: string;
  password: string;
  confirmPassword: string;
  mobileNumber: string;
  selectedDepartments: string[];
  logoUrl: string;
  address: string;
  taxPercentage: string;
  gstNumber: string;
  cin: string;
}

interface ValidationErrors {
  organizationName?: string;
  domain?: string;
  username?: string;
  orgEmail?: string;
  password?: string;
  confirmPassword?: string;
  mobileNumber?: string;
  selectedDepartments?: string;
  logoUrl?: string;
  address?: string;
  taxPercentage?: string;
  gstNumber?: string;
  cin?: string;
}

const OrganizationOnboarding: React.FC = () => {
  const router = useRouter();
  const [formData, setFormData] = useState<OnboardingFormData>({
    organizationName: '',
    domain: '',
    username: '',
    orgEmail: '',
    password: '',
    confirmPassword: '',
    mobileNumber: '',
    selectedDepartments: [],
    logoUrl: '',
    address: '',
    taxPercentage: '',
    gstNumber: '',
    cin: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [submitMessage, setSubmitMessage] = useState('');

  // Validation functions
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateDomain = (domain: string): boolean => {
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
    return domainRegex.test(domain);
  };

  const validatePassword = (password: string): boolean => {
    return password.length >= 8 && 
           /[A-Z]/.test(password) && 
           /[a-z]/.test(password) && 
           /[0-9]/.test(password);
  };

  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {};

    // Organization Name
    if (!formData.organizationName.trim()) {
      newErrors.organizationName = 'Organization name is required';
    } else if (formData.organizationName.length < 2) {
      newErrors.organizationName = 'Organization name must be at least 2 characters';
    }

    // Domain
    if (!formData.domain.trim()) {
      newErrors.domain = 'Domain is required';
    } else if (!validateDomain(formData.domain)) {
      newErrors.domain = 'Please enter a valid domain (e.g., company.com)';
    }

    // Username
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      newErrors.username = 'Username can only contain letters, numbers, and underscores';
    }

    // Organization Email
    if (!formData.orgEmail.trim()) {
      newErrors.orgEmail = 'Organization email is required';
    } else if (!validateEmail(formData.orgEmail)) {
      newErrors.orgEmail = 'Please enter a valid email address';
    }

    // Password
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (!validatePassword(formData.password)) {
      newErrors.password = 'Password must be at least 8 characters with uppercase, lowercase, and number';
    }

    // Confirm Password
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof OnboardingFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      const response = await fetch('/api/org-onboarding-new', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationName: formData.organizationName,
          domain: formData.domain,
          username: formData.username,
          orgEmail: formData.orgEmail,
          password: formData.password,
          mobileNumber: formData.mobileNumber,
          selectedDepartments: formData.selectedDepartments,
          logoUrl: formData.logoUrl || null,
          address: formData.address || null,
          taxPercentage: formData.taxPercentage ? parseFloat(formData.taxPercentage) : null,
          gstNumber: formData.gstNumber || null,
          cin: formData.cin || null
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setSubmitStatus('success');
        setSubmitMessage('Organization created successfully! Redirecting to email verification...');
        
        // Redirect to verification page with email parameter
        setTimeout(() => {
          router.push(`/org-verify-new?email=${encodeURIComponent(formData.orgEmail)}&registrationId=${result.registrationId}`);
        }, 2000);
      } else {
        setSubmitStatus('error');
        setSubmitMessage(result.error || 'An error occurred during registration');
      }
    } catch (error) {
      setSubmitStatus('error');
      setSubmitMessage('Network error. Please try again.');
      console.error('Onboarding error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-6xl w-full bg-white rounded-2xl shadow-xl p-8 my-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Organization Onboarding
          </h1>
          <p className="text-gray-600">
            Create your organization account to get started
          </p>
        </div>

        {/* Status Messages */}
        {submitStatus === 'success' && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center">
            <CheckCircle className="w-5 h-5 text-green-600 mr-3" />
            <span className="text-green-800 text-sm">{submitMessage}</span>
          </div>
        )}

        {submitStatus === 'error' && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
            <AlertCircle className="w-5 h-5 text-red-600 mr-3" />
            <span className="text-red-800 text-sm">{submitMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Row 1: Organization Name & Domain */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Organization Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Organization Name *
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={formData.organizationName}
                  onChange={(e) => handleInputChange('organizationName', e.target.value)}
                  className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.organizationName ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter your organization name"
                  disabled={isSubmitting}
                />
              </div>
              {errors.organizationName && (
                <p className="mt-1 text-sm text-red-600">{errors.organizationName}</p>
              )}
            </div>

            {/* Domain */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Domain *
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={formData.domain}
                  onChange={(e) => handleInputChange('domain', e.target.value)}
                  className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.domain ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="company.com"
                  disabled={isSubmitting}
                />
              </div>
              {errors.domain && (
                <p className="mt-1 text-sm text-red-600">{errors.domain}</p>
              )}
            </div>
          </div>

          {/* Row 2: Username & Organization Email */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Username */}
            <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Username *
            </label>
            <div className="relative">
              <User className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={formData.username}
                onChange={(e) => handleInputChange('username', e.target.value)}
                className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.username ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Choose a unique username"
                disabled={isSubmitting}
              />
            </div>
            {errors.username && (
              <p className="mt-1 text-sm text-red-600">{errors.username}</p>
            )}
            </div>

            {/* Organization Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Organization Email *
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={formData.orgEmail}
                onChange={(e) => handleInputChange('orgEmail', e.target.value)}
                className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.orgEmail ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="admin@company.com"
                disabled={isSubmitting}
              />
            </div>
            {errors.orgEmail && (
              <p className="mt-1 text-sm text-red-600">{errors.orgEmail}</p>
            )}
            </div>
          </div>

          {/* Row 3: Password & Confirm Password */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Password */}
            <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password *
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.password ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Create a strong password"
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                disabled={isSubmitting}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-sm text-red-600">{errors.password}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Must be 8+ characters with uppercase, lowercase, and number
            </p>
            </div>

            {/* Confirm Password */}
            <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confirm Password *
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.confirmPassword ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Confirm your password"
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                disabled={isSubmitting}
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
            )}
            </div>
          </div>

          {/* Address - Full Width */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Complete Address (Optional)
            </label>
            <textarea
              value={formData.address}
              onChange={(e) => handleInputChange('address', e.target.value)}
              rows={3}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.address ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="Enter your organization's complete address"
              disabled={isSubmitting}
            />
            {errors.address && (
              <p className="mt-1 text-sm text-red-600">{errors.address}</p>
            )}
          </div>

          {/* Row 4: Logo URL & Tax Percentage */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Logo URL */}
            <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Logo URL (Optional)
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="url"
                value={formData.logoUrl}
                onChange={(e) => handleInputChange('logoUrl', e.target.value)}
                className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.logoUrl ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="https://example.com/logo.png"
                disabled={isSubmitting}
              />
            </div>
            {errors.logoUrl && (
              <p className="mt-1 text-sm text-red-600">{errors.logoUrl}</p>
            )}
            </div>

            {/* Tax Percentage */}
            <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tax Percentage (Optional)
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={formData.taxPercentage}
                onChange={(e) => handleInputChange('taxPercentage', e.target.value)}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.taxPercentage ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="18.00"
                disabled={isSubmitting}
              />
              <span className="absolute right-3 top-3 text-gray-400">%</span>
            </div>
            {errors.taxPercentage && (
              <p className="mt-1 text-sm text-red-600">{errors.taxPercentage}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Tax percentage that will be levied on customers (0-100)
            </p>
            </div>
          </div>

          {/* Row 5: GST Number & CIN */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* GST Number */}
            <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              GST Number (Optional)
            </label>
            <input
              type="text"
              value={formData.gstNumber}
              onChange={(e) => handleInputChange('gstNumber', e.target.value.toUpperCase())}
              maxLength={15}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.gstNumber ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="22AAAAA0000A1Z5"
              disabled={isSubmitting}
            />
            {errors.gstNumber && (
              <p className="mt-1 text-sm text-red-600">{errors.gstNumber}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              15-character alphanumeric GST identification number
            </p>
            </div>

            {/* CIN */}
            <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              CIN - Corporate Identification Number (Optional)
            </label>
            <input
              type="text"
              value={formData.cin}
              onChange={(e) => handleInputChange('cin', e.target.value.toUpperCase())}
              maxLength={21}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.cin ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="U12345AB2021PLC123456"
              disabled={isSubmitting}
            />
            {errors.cin && (
              <p className="mt-1 text-sm text-red-600">{errors.cin}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              21-character Corporate Identification Number
            </p>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Creating Organization...
              </>
            ) : (
              'Create Organization'
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Already have an organization?{' '}
            <button
              onClick={() => router.push('/org-login')}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Sign In
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default OrganizationOnboarding;