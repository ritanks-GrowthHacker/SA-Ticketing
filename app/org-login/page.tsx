'use client';

import React, { useState, useCallback } from 'react';
import { Building2, User, Lock, Eye, EyeOff, LogIn, AlertCircle, CheckCircle, Mail, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useOrganizationStore } from '../store/organizationStore';
import BaseModal from '@/components/modals/BaseModal';
import OTPVerification from '@/components/OTPVerification';

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
  
  // Forgot password states
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [showOTP, setShowOTP] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [resetIdentifier, setResetIdentifier] = useState(''); // email or username
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

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

  // Forgot password handler
  const handleForgotPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setResetError(null);
    setResetSuccess(null);
    setIsSubmitting(true);

    try {
      const isEmail = resetIdentifier.includes('@');
      const payload = isEmail 
        ? { email: resetIdentifier } 
        : { username: resetIdentifier };

      const response = await fetch('/api/org-forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setResetSuccess('OTP sent to your organization email!');
        setForgotPasswordEmail(data.email || resetIdentifier);
        setShowForgotPasswordModal(false);
        setShowOTP(true);
      } else {
        setResetError(data.error || 'Failed to send reset email');
      }
    } catch (error) {
      setResetError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // OTP verification success
  const handleOTPSuccess = useCallback(() => {
    setShowOTP(false);
    setShowPasswordReset(true);
    setResetSuccess('OTP verified! Please set your new password.');
  }, []);

  // Password reset handler
  const handlePasswordReset = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setResetError(null);
    setResetSuccess(null);

    if (newPassword.length < 8) {
      setResetError('Password must be at least 8 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setResetError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);

    try {
      const isEmail = forgotPasswordEmail.includes('@');
      const payload = {
        ...(isEmail ? { email: forgotPasswordEmail } : { username: forgotPasswordEmail }),
        newPassword,
        confirmPassword
      };

      const response = await fetch('/api/org-reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setResetSuccess('Password reset successfully! Please login with your new password.');
        setShowPasswordReset(false);
        setLoginStatus('success');
        setLoginMessage('Password reset successful! You can now log in.');
      } else {
        setResetError(data.error || 'Failed to reset password');
      }
    } catch (error) {
      setResetError('Network error. Please try again.');
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
              onClick={() => setShowForgotPasswordModal(true)}
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

      {/* Forgot Password Modal */}
      {showForgotPasswordModal && (
        <BaseModal
          isOpen={showForgotPasswordModal}
          onClose={() => setShowForgotPasswordModal(false)}
          title="Reset Organization Password"
          size="md"
        >
          <form onSubmit={handleForgotPassword} className="space-y-4 p-4">
            {resetSuccess && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                <span className="text-green-800 text-sm">{resetSuccess}</span>
              </div>
            )}
            
            {resetError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                <span className="text-red-800 text-sm">{resetError}</span>
              </div>
            )}

            <p className="text-sm text-gray-600 leading-relaxed">
              Enter your organization email or username to receive a password reset OTP.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Email or Username
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={resetIdentifier}
                  onChange={(e) => setResetIdentifier(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="Enter email or username"
                  required
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowForgotPasswordModal(false)}
                className="flex-1 px-5 py-2.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors font-medium text-gray-700"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-5 py-2.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-sm"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Sending...
                  </span>
                ) : (
                  'Send OTP'
                )}
              </button>
            </div>
          </form>
        </BaseModal>
      )}

      {/* OTP Verification Modal */}
      {showOTP && (
        <BaseModal
          isOpen={showOTP}
          onClose={() => setShowOTP(false)}
          title="Verify OTP"
          size="md"
        >
          <OTPVerification
            email={forgotPasswordEmail}
            type="org-password-reset"
            onVerificationSuccess={handleOTPSuccess}
            onResendOTP={async () => {
              const isEmail = forgotPasswordEmail.includes('@');
              const payload = isEmail 
                ? { email: forgotPasswordEmail } 
                : { username: forgotPasswordEmail };
              
              await fetch('/api/org-forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              });
            }}
          />
        </BaseModal>
      )}

      {/* Password Reset Modal */}
      {showPasswordReset && (
        <BaseModal
          isOpen={showPasswordReset}
          onClose={() => setShowPasswordReset(false)}
          title="Set New Password"
          size="md"
        >
          <form onSubmit={handlePasswordReset} className="space-y-5 p-3">
            {resetSuccess && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                <span className="text-green-800 text-sm">{resetSuccess}</span>
              </div>
            )}
            
            {resetError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                <span className="text-red-800 text-sm">{resetError}</span>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Enter new password"
                required
                minLength={8}
                disabled={isSubmitting}
              />
              <p className="mt-1.5 text-xs text-gray-500">Must be at least 8 characters</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Confirm new password"
                required
                minLength={8}
                disabled={isSubmitting}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowPasswordReset(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Resetting...
                  </span>
                ) : (
                  'Reset Password'
                )}
              </button>
            </div>
          </form>
        </BaseModal>
      )}
    </div>
  );
};

export default OrganizationLogin;