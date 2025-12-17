'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface InvitationDetails {
  id: string;
  email: string;
  name?: string;
  jobTitle?: string;
  phone?: string;
  organizationId: string;
  organizationName: string;
  departmentId: string;
  departmentName: string;
}

const RegisterUser = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Form data
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });

  // OTP states
  const [showOTP, setShowOTP] = useState(false);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpLoading, setOtpLoading] = useState(false);

  useEffect(() => {
    // If token is provided in URL, verify invitation immediately
    const token = searchParams.get('token');
    if (token) {
      verifyInvitationToken(token);
    }
  }, []);

  const verifyInvitationToken = async (token: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/verify-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });

      const data = await response.json();
      
      if (response.ok) {
        setInvitation(data.invitation);
        setEmail(data.invitation.email);
        setFormData(prev => ({
          ...prev,
          name: data.invitation.name || ''
        }));
        setCurrentStep(2); // Skip email verification step
      } else {
        setError(data.error || 'Invalid invitation link');
      }
    } catch (error) {
      setError('Failed to verify invitation');
    } finally {
      setIsLoading(false);
    }
  };

  const verifyEmail = async () => {
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/verify-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();
      
      if (response.ok) {
        setInvitation(data.invitation);
        setFormData(prev => ({
          ...prev,
          name: data.invitation.name || ''
        }));
        setCurrentStep(2);
      } else {
        setError(data.error || 'No invitation found for this email');
      }
    } catch (error) {
      setError('Failed to verify email');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }
    
    if (!formData.password || formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/complete-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invitationId: invitation?.id,
          email: email,
          password: formData.password,
          name: formData.name,
          phone: formData.phone || null
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        setSuccess('Registration completed successfully!');
        setShowOTP(true);
        // OTP is already sent by complete-registration API
      } else {
        setError(data.error || 'Registration failed');
      }
    } catch (error) {
      setError('Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };



  const handleOTPChange = (index: number, value: string) => {
    if (value.length <= 1 && /^\d*$/.test(value)) {
      const newOtp = [...otpDigits];
      newOtp[index] = value;
      setOtpDigits(newOtp);

      // Auto-focus next input
      if (value && index < 5) {
        const nextInput = document.getElementById(`otp-${index + 1}`);
        nextInput?.focus();
      }

      // Auto-verify when all digits are entered
      if (index === 5 && value && newOtp.every(digit => digit)) {
        verifyOTP(newOtp.join(''));
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      prevInput?.focus();
    }
  };

  const verifyOTP = async (otpCode?: string) => {
    // Use provided OTP code or join from state
    const code = otpCode || otpDigits.join('');
    if (!code || code.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }

    setOtpLoading(true);
    setError('');

    try {
      const response = await fetch('/api/verify-registration-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          otp: code,
          userData: { organization_id: invitation?.organizationId }
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        setSuccess('Email verified successfully! Redirecting to login...');
        setTimeout(() => {
          router.push('/user-login');
        }, 2000);
      } else {
        setError(data.error || 'Invalid OTP');
      }
    } catch (error) {
      setError('OTP verification failed');
    } finally {
      setOtpLoading(false);
    }
  };



  if (isLoading && currentStep === 1) {
    return (
      <div className="min-h-screen bg-linear-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verifying invitation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 via-indigo-50 to-purple-50 py-12 px-4">
      <div className="max-w-md mx-auto">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🎉 Welcome!
          </h1>
          <p className="text-gray-600">
            {invitation ? `Join ${invitation.organizationName}` : 'Complete your registration'}
          </p>
        </div>

        {/* Progress indicator */}
        {!showOTP && (
          <div className="flex justify-center mb-8">
            <div className="flex items-center space-x-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep >= 1 ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                1
              </div>
              <div className={`w-16 h-1 ${currentStep >= 2 ? 'bg-indigo-600' : 'bg-gray-200'}`}></div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep >= 2 ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                2
              </div>
            </div>
          </div>
        )}

        {/* Error/Success Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
            {success}
          </div>
        )}

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          
          {/* Step 1: Email Verification */}
          {currentStep === 1 && !showOTP && (
            <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">
                    Enter your email
                  </h2>
                  <p className="text-gray-600 text-sm mb-4">
                    Enter the email address that received the invitation
                  </p>
                  
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your.email@company.com"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    disabled={isLoading}
                  />
                </div>
                
                <button
                  onClick={verifyEmail}
                  disabled={isLoading}
                  className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
                >
                  {isLoading ? 'Verifying...' : 'Continue'}
                </button>
            </div>
          )}

          {/* Step 2: User Details */}
          {currentStep === 2 && !showOTP && (
            <div className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Almost there! 🚀
                  </h2>
                  <p className="text-gray-600 text-sm mt-2">
                    You're joining <span className="font-medium text-indigo-600">{invitation?.organizationName}</span> as {invitation?.jobTitle}
                  </p>
                  <div className="mt-2 text-sm text-gray-500">
                    Department: {invitation?.departmentName}
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Name - Required */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter your full name"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>

                  {/* Phone - Optional */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number
                      <span className="text-gray-400 ml-1">(optional)</span>
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+1 (555) 123-4567"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, phone: '' }))}
                      className="text-sm text-indigo-600 hover:text-indigo-800 mt-1"
                    >
                      Skip this field
                    </button>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Password *
                    </label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      placeholder="Create a secure password"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Confirm Password *
                    </label>
                    <input
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder="Confirm your password"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
                >
                  {isLoading ? 'Creating Account...' : 'Create Account'}
                </button>
            </div>
          )}

          {/* OTP Verification */}
          {showOTP && (
            <div className="space-y-6 text-center">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">
                    📧 Verify your email
                  </h2>
                  <p className="text-gray-600 text-sm mb-4">
                    We've sent a verification code to
                    <br />
                    <span className="font-medium">{email}</span>
                  </p>
                  
                  <div className="flex justify-center space-x-2">
                    {Array.from({ length: 6 }, (_, index) => (
                      <input
                        key={index}
                        id={`otp-${index}`}
                        type="text"
                        maxLength={1}
                        value={otpDigits[index] || ''}
                        onChange={(e) => handleOTPChange(index, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(index, e)}
                        className="w-12 h-12 text-center text-lg font-semibold border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    ))}
                  </div>
                </div>
                
                <button
                  onClick={() => verifyOTP()}
                  disabled={otpLoading}
                  className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
                >
                  {otpLoading ? 'Verifying...' : 'Verify & Complete'}
                </button>

                <button
                  onClick={() => setError('Please contact support for OTP resend')}
                  className="text-sm text-indigo-600 hover:text-indigo-800"
                >
                  Resend code
                </button>
            </div>
          )}

        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{' '}
          <button
            onClick={() => router.push('/user-login')}
            className="text-indigo-600 hover:text-indigo-800 font-medium"
          >
            Sign in here
          </button>
        </p>
      </div>
    </div>
  );
};

export default RegisterUser;