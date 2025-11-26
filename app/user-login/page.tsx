'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useApiClient } from '../store/apiClient'
import { useAuth, useAuthActions } from '../store/authStore'
import CoverPageAnimation from '../../public/assets/lottie-animations/coverPage'

import OTPVerification from '../../components/OTPVerification'

export default function AuthPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [isRedirecting, setIsRedirecting] = useState(false)
  const [showOTP, setShowOTP] = useState(false)
  const [otpData, setOtpData] = useState<{
    email: string;
    type: 'registration' | 'login' | 'password-reset';
    userData?: any;
  } | null>(null)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [showPasswordReset, setShowPasswordReset] = useState(false)
  const [resetEmail, setResetEmail] = useState('') 
  
  const { login } = useApiClient()
  const { isAuthenticated, token } = useAuth()
  const { login: authLogin } = useAuthActions()
  const router = useRouter()

  // Simple redirect to dashboard on authentication
  useEffect(() => {
    // Check if user is logged in as organization - redirect to org dashboard
    const orgToken = localStorage.getItem('orgToken');
    if (orgToken) {
      console.log('🏢 User has org token, redirecting to organization dashboard');
      router.push('/organization-redirects/dashboard');
      return;
    }
    
    const redirectUser = async () => {
      if (isAuthenticated && !isRedirecting) {
        setIsRedirecting(true);
        
        // Check if user is sales-only
        if (token) {
          try {
            const response = await fetch('/api/check-user-departments', {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });
            
            if (response.ok) {
              const data = await response.json();
              
              // If user is sales-only, redirect to sales dashboard
              if (data.isSalesOnly) {
                router.push('/sales');
                return;
              }
            }
          } catch (error) {
            console.error('Error checking departments:', error);
          }
        }
        
        // Default redirect to dashboard
        router.push('/dashboard');
      }
    };
    
    redirectUser();
  }, [isAuthenticated, isRedirecting, router, token]);

  // Reset redirecting flag when not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      setIsRedirecting(false)
    }
  }, [isAuthenticated])

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    try {
      const data = await login(email, password)
      console.log('Login response:', data)

      if (data?.success) {
        // Login API sent OTP, show OTP screen
        setOtpData({
          email: email,
          type: 'login'
        })
        setShowOTP(true)
        setSuccess('OTP sent to your email. Please verify to continue.')
      } else {
        setError(data?.error || 'Login failed. Please try again.')
      }
    } catch (err: any) {
      console.error('Login error:', err)
      setError('Login failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleOTPVerificationSuccess = (data: any) => {
    if (otpData?.type === 'password-reset') {
      handlePasswordResetOTPSuccess(data)
      return
    }

    // Hide OTP screen and clear OTP data immediately after successful verification
    setShowOTP(false)
    setOtpData(null)
    
    // Store the authentication data for login/registration
    authLogin({
      user: data.user,
      organization: data.organization,
      role: data.role, // Project role (dominant)
      roles: data.roles,
      token: data.token,
      project: data.project || null, // Project context
      department: data.department || null, // Department context
      departments: data.departments || [], // All departments
      hasMultipleDepartments: data.hasMultipleDepartments || false
    })
    
    setSuccess('OTP verified successfully! Redirecting to dashboard...')
    
    // Redirect will be handled by the useEffect watching isAuthenticated
  }

  const handleResendOTP = async () => {
    if (!otpData) return

    try {
      const response = await fetch('/api/resend-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: otpData.email,
          type: otpData.type
        }),
      })

      if (response.ok) {
        setSuccess('OTP resent successfully!')
      } else {
        setError('Failed to resend OTP')
      }
    } catch (error) {
      setError('Failed to resend OTP')
    }
  }

  // Forgot password handlers
  const handleForgotPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string

    try {
      const response = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setSuccess('Password reset OTP sent to your email!')
        setShowForgotPassword(false)
        setShowOTP(true)
        setOtpData({
          email,
          type: 'password-reset'
        })
        setResetEmail(email)
      } else {
        setError(data.error || 'Failed to send reset email')
      }
    } catch (error) {
      setError('Failed to send reset email')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePasswordResetOTPSuccess = useCallback((data: any) => {
    setShowOTP(false)
    setShowPasswordReset(true)
    setSuccess('OTP verified! Please set your new password.')
  }, [])

  const handlePasswordReset = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    const newPassword = formData.get('newPassword') as string
    const confirmPassword = formData.get('confirmPassword') as string

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch('/api/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: resetEmail,
          newPassword,
          confirmPassword
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setSuccess('Password reset successfully! Please login with your new password.')
        setShowPasswordReset(false)
        // Clear reset state
        setResetEmail('')
        setOtpData(null)
      } else {
        setError(data.error || 'Failed to reset password')
      }
    } catch (error) {
      setError('Failed to reset password')
    } finally {
      setIsLoading(false)
    }
  }

  // Show loading state while redirecting
  if (isAuthenticated && isRedirecting) {
    return (
      <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting to dashboard...</p>
        </div>
      </div>
    )
  }

  // Show OTP verification screen
  if (showOTP && otpData) {
    return (
      <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <OTPVerification
            email={otpData.email}
            onVerificationSuccess={handleOTPVerificationSuccess}
            onResendOTP={handleResendOTP}
            type={otpData.type}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100">
      <div className="flex">
        
        {/* Left Side - Animation/Branding */}
        <div className="hidden lg:flex lg:w-1/2 min-h-screen items-center justify-center bg-linear-to-br from-indigo-600 to-purple-700 relative overflow-hidden">
          <div className="absolute inset-0 bg-black/20"></div>
          <div className="relative z-10 text-center text-white px-8">
            <h1 className="text-4xl font-bold mb-4">Ticketing-Metrix</h1>
            <p className="text-xl mb-8 opacity-90">Streamline your workflow, amplify your productivity</p>
            <div className="max-w-md mx-auto">
              <CoverPageAnimation />
            </div>
          </div>
        </div>

        {/* Right Side - Auth Form */}
        <div className="w-full lg:w-1/2 min-h-screen flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">
            
            {/* Header */}
            <div className="text-center mb-8">
              <div className="lg:hidden mb-6">
                <h1 className="text-3xl font-bold text-gray-900">Ticketing-Metrix</h1>
                <p className="text-gray-600 mt-2">Welcome back!</p>
              </div>
              
              {/* Login Header */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 text-center">Sign In</h2>
                <p className="text-gray-600 text-center mt-2">Welcome back! Please sign in to your account.</p>
              </div>
            </div>

            {/* Alert Messages */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800 text-sm flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {error}
                </p>
              </div>
            )}

            {success && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800 text-sm flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  {success}
                </p>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                  placeholder="Enter your email"
                />
              </div>



              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  type="password"
                  id="password"
                  name="password"
                  required
                  className="mt-2 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                  placeholder="Enter your password"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-linear-to-r from-blue-600 to-indigo-600 text-white py-3 px-4 rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            {/* Footer */}
            <div className="mt-8 text-center">
              <p className="text-sm text-gray-600">
                Received an invitation?{' '}
                <button
                  onClick={() => router.push('/register-user')}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Register here
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900">Reset Password</h3>
              <p className="text-gray-600 mt-2">Enter your email to receive a reset OTP</p>
            </div>
            
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  id="reset-email"
                  name="email"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your email"
                />
              </div>
              
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isLoading ? 'Sending...' : 'Send OTP'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {showPasswordReset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900">Set New Password</h3>
              <p className="text-gray-600 mt-2">Enter your new password</p>
            </div>
            
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div>
                <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  id="new-password"
                  name="newPassword"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter new password"
                />
              </div>
              
              <div>
                <label htmlFor="confirm-new-password" className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  id="confirm-new-password"
                  name="confirmPassword"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Confirm new password"
                />
              </div>
              
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordReset(false)
                    setResetEmail('')
                    setOtpData(null)
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isLoading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}