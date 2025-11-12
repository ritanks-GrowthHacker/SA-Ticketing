'use client';

import React, { useState, useEffect } from 'react';
import { Mail, Clock, CheckCircle, ArrowRight, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useOrganizationStore } from '../store/organizationStore';

const OrgOTPVerification: React.FC = () => {
  const router = useRouter();
  const { currentOrg, getCurrentOrgId, setCurrentOrgById } = useOrganizationStore();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isVerifying, setIsVerifying] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
  const [canResend, setCanResend] = useState(false);
  const [error, setError] = useState('');
  const [verificationSuccess, setVerificationSuccess] = useState(false);

  // Check if we have organization data
  useEffect(() => {
    const orgId = getCurrentOrgId();
    if (!orgId || !currentOrg) {
      router.push('/org-login');
      return;
    }
  }, [currentOrg, getCurrentOrgId, router]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [timeLeft]);

  // Handle OTP input
  const handleOTPChange = (index: number, value: string) => {
    if (value.length <= 1 && /^[0-9]*$/.test(value)) {
      const newOTP = [...otp];
      newOTP[index] = value;
      setOtp(newOTP);
      setError('');

      // Auto-focus next input
      if (value && index < 5) {
        const nextInput = document.getElementById(`otp-${index + 1}`);
        nextInput?.focus();
      }
    }
  };

  // Handle backspace
  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      prevInput?.focus();
    }
  };

  // Format time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Verify OTP
  const handleVerifyOTP = async () => {
    const otpCode = otp.join('');
    
    if (otpCode.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }

    setIsVerifying(true);
    setError('');

    try {
      const response = await fetch('/api/org-verify-login-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orgId: currentOrg?.id,
          otp: otpCode,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setVerificationSuccess(true);
        
        // Update store with latest organization data
        if (result.organization) {
          setCurrentOrgById(result.organization.id, result.organization);
        }
        
        setTimeout(() => {
          // Check if organization has departments configured from API response
          if (result.organization?.has_departments) {
            // Organization already has departments - go to dashboard
            router.push('/organization-redirects/dashboard');
          } else {
            // Organization needs department setup
            router.push('/org-setup');
          }
        }, 2000);
      } else {
        setError(result.error || 'Invalid OTP code. Please try again.');
      }
    } catch (error) {
      setError('Network error. Please try again.');
      console.error('OTP verification error:', error);
    } finally {
      setIsVerifying(false);
    }
  };

  // Resend OTP
  const handleResendOTP = async () => {
    try {
      const response = await fetch('/api/org-resend-login-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orgId: currentOrg?.id,
        }),
      });

      if (response.ok) {
        setTimeLeft(300);
        setCanResend(false);
        setOtp(['', '', '', '', '', '']);
        setError('');
      } else {
        const result = await response.json();
        setError(result.error || 'Failed to resend OTP');
      }
    } catch (error) {
      setError('Network error. Please try again.');
      console.error('Resend OTP error:', error);
    }
  };

  if (!currentOrg) {
    return (
      <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-4">
            {verificationSuccess ? (
              <CheckCircle className="w-8 h-8 text-white" />
            ) : (
              <Shield className="w-8 h-8 text-white" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {verificationSuccess ? 'Verification Successful!' : 'Verify Your Organization'}
          </h1>
          <p className="text-gray-600">
            {verificationSuccess ? 
              'Redirecting to organization setup...' :
              `We've sent a 6-digit code to ${currentOrg.org_email || 'your organization email'}`
            }
          </p>
        </div>

        {verificationSuccess ? (
          <div className="text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-green-600 font-medium">Setting up your organization...</p>
          </div>
        ) : (
          <>
            {/* Organization Info */}
            {currentOrg.name && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <span className="font-medium">Organization:</span> {currentOrg.name}
                </p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            {/* OTP Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Enter verification code
              </label>
              <div className="flex justify-between space-x-2">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    id={`otp-${index}`}
                    type="text"
                    value={digit}
                    onChange={(e) => handleOTPChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className="w-12 h-12 text-center text-lg font-semibold border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    maxLength={1}
                    disabled={isVerifying}
                  />
                ))}
              </div>
            </div>

            {/* Timer */}
            <div className="mb-6 flex items-center justify-center text-sm text-gray-600">
              <Clock className="w-4 h-4 mr-2" />
              Code expires in: {formatTime(timeLeft)}
            </div>

            {/* Verify Button */}
            <button
              onClick={handleVerifyOTP}
              disabled={isVerifying || otp.some(digit => !digit)}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed mb-4"
            >
              {isVerifying ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Verifying...
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  Verify Organization
                  <ArrowRight className="w-4 h-4 ml-2" />
                </div>
              )}
            </button>

            {/* Resend OTP */}
            <div className="text-center">
              <button
                onClick={handleResendOTP}
                disabled={!canResend}
                className={`text-sm ${
                  canResend 
                    ? 'text-blue-600 hover:text-blue-800' 
                    : 'text-gray-400 cursor-not-allowed'
                }`}
              >
                Didn't receive the code? 
                {canResend ? ' Resend OTP' : ` Resend in ${formatTime(timeLeft)}`}
              </button>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="mt-6 pt-6 border-t border-gray-200 text-center">
          <button
            onClick={() => router.push('/org-login')}
            className="text-sm text-gray-600 hover:text-gray-800"
            disabled={isVerifying}
          >
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrgOTPVerification;