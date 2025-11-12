'use client';

import React, { useState } from 'react';
import { Building2, User, Lock, Eye, EyeOff, LogIn, AlertCircle, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useOrganizationStore } from '../store/organizationStore';

interface LoginFormData {
  username: string;
  password: string;
}

interface ValidationErrors {
  username?: string;
  password?: string;
}

const OrganizationLogin: React.FC = () => {
  const router = useRouter();
  const { setCurrentOrgById } = useOrganizationStore();
  const [formData, setFormData] = useState<LoginFormData>({
    username: '',
    password: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginStatus, setLoginStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [loginMessage, setLoginMessage] = useState('');

  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {};

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof LoginFormData, value: string) => {
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
    setLoginStatus('idle');

    try {
      const response = await fetch('/api/org-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok) {
        setLoginStatus('success');
        setLoginMessage('Login successful! Redirecting...');
        
        // Store the organization token/session
        if (result.token) {
          localStorage.setItem('orgToken', result.token);
        }
        
        // Store organization in Zustand store
        if (result.organization) {
          setCurrentOrgById(result.organization.id, result.organization);
        }
        
        // Always go to OTP verification first for security
        setTimeout(() => {
          router.push('/otp-verification');
        }, 1500);
      } else {
        setLoginStatus('error');
        setLoginMessage(result.error || 'Invalid username or password');
      }
    } catch (error) {
      setLoginStatus('error');
      setLoginMessage('Network error. Please try again.');
      console.error('Login error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Organization Login
          </h1>
          <p className="text-gray-600">
            Sign in to your organization account
          </p>
        </div>

        {/* Status Messages */}
        {loginStatus === 'success' && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center">
            <CheckCircle className="w-5 h-5 text-green-600 mr-3" />
            <span className="text-green-800 text-sm">{loginMessage}</span>
          </div>
        )}

        {loginStatus === 'error' && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
            <AlertCircle className="w-5 h-5 text-red-600 mr-3" />
            <span className="text-red-800 text-sm">{loginMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Username
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
                placeholder="Enter your username"
                disabled={isSubmitting}
                autoComplete="username"
              />
            </div>
            {errors.username && (
              <p className="mt-1 text-sm text-red-600">{errors.username}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
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
                placeholder="Enter your password"
                disabled={isSubmitting}
                autoComplete="current-password"
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
          </div>

          {/* Forgot Password Link */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => router.push('/org-forgot-password')}
              className="text-sm text-blue-600 hover:text-blue-800"
              disabled={isSubmitting}
            >
              Forgot your password?
            </button>
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
                Signing In...
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4 mr-2" />
                Sign In
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-6 text-center space-y-2">
          <p className="text-sm text-gray-600">
            Don't have an organization account?{' '}
            <button
              onClick={() => router.push('/org-onboarding')}
              className="text-blue-600 hover:text-blue-800 font-medium"
              disabled={isSubmitting}
            >
              Create Organization
            </button>
          </p>
          
          <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
            <span>•</span>
            <button
              onClick={() => router.push('/user-login')}
              className="text-blue-600 hover:text-blue-800"
              disabled={isSubmitting}
            >
              User Login
            </button>
            <span>•</span>
            <button
              onClick={() => router.push('/')}
              className="text-blue-600 hover:text-blue-800"
              disabled={isSubmitting}
            >
              Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrganizationLogin;