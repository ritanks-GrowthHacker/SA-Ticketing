'use client';

import React, { useState, useCallback } from 'react';
import { Building2, Mail, User, Lock, Eye, EyeOff, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import OTPVerification from '@/components/OTPVerification';

type Step = 'email' | 'otp' | 'reset' | 'success';

const OrganizationForgotPassword: React.FC = () => {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>('email');
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [organizationEmail, setOrganizationEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Handle forgot password submission (send OTP)
  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      // Determine if input is email or username
      const isEmail = emailOrUsername.includes('@');
      const payload = isEmail 
        ? { email: emailOrUsername } 
        : { username: emailOrUsername };

      const response = await fetch('/api/org-forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccess('OTP sent to your organization email!');
        setOrganizationEmail(data.email || emailOrUsername);
        setTimeout(() => {
          setCurrentStep('otp');
        }, 1500);
      } else {
        setError(data.error || 'Failed to send OTP');
      }
    } catch (error) {
      console.error('Send OTP error:', error);
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle OTP verification success
  const handleOTPSuccess = useCallback(() => {
    setSuccess('OTP verified successfully!');
    setTimeout(() => {
      setCurrentStep('reset');
      setSuccess(null);
    }, 1000);
  }, []);

  // Handle password reset
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validate passwords
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const isEmail = organizationEmail.includes('@');
      const payload = {
        ...(isEmail ? { email: organizationEmail } : { username: organizationEmail }),
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
        setSuccess('Password reset successfully!');
        setCurrentStep('success');
      } else {
        setError(data.error || 'Failed to reset password');
      }
    } catch (error) {
      console.error('Password reset error:', error);
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
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
            Reset Organization Password
          </h1>
          <p className="text-gray-600">
            {currentStep === 'email' && 'Enter your email or username to receive an OTP'}
            {currentStep === 'otp' && 'Verify the OTP sent to your email'}
            {currentStep === 'reset' && 'Create a new password for your organization'}
            {currentStep === 'success' && 'Your password has been reset successfully'}
          </p>
        </div>

        {/* Status Messages */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center">
            <CheckCircle className="w-5 h-5 text-green-600 mr-3 flex-shrink-0" />
            <span className="text-green-800 text-sm">{success}</span>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
            <AlertCircle className="w-5 h-5 text-red-600 mr-3 flex-shrink-0" />
            <span className="text-red-800 text-sm">{error}</span>
          </div>
        )}

        {/* Step 1: Email/Username Input */}
        {currentStep === 'email' && (
          <form onSubmit={handleSendOTP} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Organization Email or Username
              </label>
              <div className="relative">
                <User className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={emailOrUsername}
                  onChange={(e) => setEmailOrUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter email or username"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Sending OTP...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Send OTP
                </>
              )}
            </button>
          </form>
        )}

        {/* Step 2: OTP Verification */}
        {currentStep === 'otp' && (
          <OTPVerification
            email={organizationEmail}
            type="org-password-reset"
            onVerificationSuccess={handleOTPSuccess}
            onResendOTP={async () => {
              const isEmail = organizationEmail.includes('@');
              const payload = isEmail 
                ? { email: organizationEmail } 
                : { username: organizationEmail };
              
              await fetch('/api/org-forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              });
            }}
          />
        )}

        {/* Step 3: Password Reset */}
        {currentStep === 'reset' && (
          <form onSubmit={handlePasswordReset} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter new password"
                  required
                  disabled={isLoading}
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                >
                  {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Password must be at least 8 characters long
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Confirm new password"
                  required
                  disabled={isLoading}
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Resetting Password...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 mr-2" />
                  Reset Password
                </>
              )}
            </button>
          </form>
        )}

        {/* Step 4: Success */}
        {currentStep === 'success' && (
          <div className="text-center">
            <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Password Reset Successful!
            </h3>
            <p className="text-gray-600 mb-6">
              Your organization password has been reset successfully. You can now log in with your new password.
            </p>
            <button
              onClick={() => router.push('/org-login')}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Go to Login
            </button>
          </div>
        )}

        {/* Back to Login */}
        {currentStep !== 'success' && (
          <div className="mt-6 text-center">
            <button
              onClick={() => router.push('/org-login')}
              className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
              disabled={isLoading}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrganizationForgotPassword;
