'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Mail, Clock, CheckCircle, Building2 } from 'lucide-react';

export default function OrganizationVerifyNewPage() {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isVerifying, setIsVerifying] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
  const [canResend, setCanResend] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get('email');
  const registrationId = searchParams.get('registrationId');

  // Redirect if no email or registrationId provided
  useEffect(() => {
    if (!email || !registrationId) {
      router.push('/org-onboarding');
    }
  }, [email, registrationId, router]);

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

      // Auto-submit when all 6 digits are entered
      if (newOTP.every(digit => digit !== '') && !isVerifying) {
        handleVerifyOTP(newOTP.join(''));
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

  // Verify OTP
  const handleVerifyOTP = async (otpCode: string) => {
    setIsVerifying(true);
    setError('');

    try {
      const response = await fetch('/api/org-verify-email-new', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          registrationId: registrationId,
          orgEmail: email,
          otp: otpCode
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccess(true);
        // Redirect to organization login after 2 seconds
        setTimeout(() => {
          router.push('/org-login?verified=true&new=true');
        }, 2000);
      } else {
        setError(data.error || 'Invalid OTP. Please try again.');
        setOtp(['', '', '', '', '', '']);
        
        // If registration expired, redirect back to registration
        if (response.status === 404) {
          setTimeout(() => {
            router.push('/org-onboarding?expired=true');
          }, 3000);
        }
      }
    } catch (error) {
      console.error('OTP verification error:', error);
      setError('Verification failed. Please try again.');
      setOtp(['', '', '', '', '', '']);
    } finally {
      setIsVerifying(false);
    }
  };

  // Resend OTP
  const handleResendOTP = async () => {
    setCanResend(false);
    setTimeLeft(300);
    setError('');

    try {
      const response = await fetch('/api/org-resend-otp-new', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          registrationId: registrationId,
          orgEmail: email 
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        setError(data.error || 'Failed to resend OTP');
        
        // If registration expired, redirect back to registration
        if (response.status === 404) {
          setTimeout(() => {
            router.push('/org-onboarding?expired=true');
          }, 3000);
        }
      }
    } catch (error) {
      console.error('Resend OTP error:', error);
      setError('Failed to resend OTP. Please try again.');
    }
  };

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Organization Created Successfully!
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Your organization has been verified and created. Redirecting to login...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!email || !registrationId) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-indigo-100">
            <Building2 className="h-6 w-6 text-indigo-600" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Verify Organization Email
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            We sent a 6-digit code to{' '}
            <span className="font-medium text-indigo-600">{email}</span>
          </p>
          <p className="mt-1 text-center text-xs text-gray-500">
            Your organization will only be created after successful verification
          </p>
        </div>

        <div className="mt-8 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Enter OTP code
            </label>
            <div className="flex justify-center space-x-2">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  id={`otp-${index}`}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOTPChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="w-12 h-12 text-center text-lg font-semibold border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  disabled={isVerifying}
                />
              ))}
            </div>
          </div>

          {isVerifying && (
            <div className="flex items-center justify-center space-x-2 text-indigo-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
              <span className="text-sm">Verifying and creating organization...</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1 text-sm text-gray-500">
              <Clock className="h-4 w-4" />
              <span>Expires in {formatTime(timeLeft)}</span>
            </div>
            
            <button
              onClick={handleResendOTP}
              disabled={!canResend || isVerifying}
              className={`text-sm font-medium ${
                canResend && !isVerifying
                  ? 'text-indigo-600 hover:text-indigo-500'
                  : 'text-gray-400 cursor-not-allowed'
              }`}
            >
              Resend Code
            </button>
          </div>

          <div className="text-center">
            <p className="text-xs text-gray-500">
              Didn't receive the code? Check your spam folder or try resending after the timer expires.
            </p>
          </div>

          <div className="text-center">
            <button
              onClick={() => router.push('/org-onboarding')}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ← Start registration again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}