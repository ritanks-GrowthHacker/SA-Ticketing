import { NextRequest, NextResponse } from 'next/server';
import { OTPService } from '@/lib/otpService';
import { pendingRegistrations } from '../org-onboarding-new/route';

interface ResendOTPRequest {
  registrationId: string;
  orgEmail: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { registrationId, orgEmail }: ResendOTPRequest = body;

    // Validate required fields
    if (!registrationId || !orgEmail) {
      return NextResponse.json(
        { error: 'Registration ID and email are required' },
        { status: 400 }
      );
    }

    // Get pending registration
    const pendingReg = pendingRegistrations.get(registrationId);
    
    if (!pendingReg) {
      return NextResponse.json(
        { error: 'Registration not found or expired. Please start registration again.' },
        { status: 404 }
      );
    }

    // Verify email matches
    if (pendingReg.orgEmail !== orgEmail) {
      return NextResponse.json(
        { error: 'Email mismatch' },
        { status: 400 }
      );
    }

    // Generate new OTP
    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const newOtpExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now

    // Update the pending registration with new OTP
    pendingReg.otp = newOtp;
    pendingReg.otpExpiresAt = newOtpExpiresAt;
    pendingRegistrations.set(registrationId, pendingReg);

    // Send new OTP email
    const emailSent = await OTPService.sendOTP(orgEmail, newOtp, 'registration');
    
    if (!emailSent) {
      return NextResponse.json({ 
        error: 'Failed to send verification email. Please try again.' 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'New OTP sent successfully. Please check your email.',
      orgEmail: orgEmail
    });

  } catch (error) {
    console.error('Error in org-resend-otp-new:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}