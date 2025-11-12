import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/db/connections';
import { OTPService } from '@/lib/otpService';
import bcrypt from 'bcryptjs';

interface ResendOTPRequest {
  orgEmail: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orgEmail }: ResendOTPRequest = body;

    // Validate required fields
    if (!orgEmail) {
      return NextResponse.json(
        { error: 'Organization email is required' },
        { status: 400 }
      );
    }

    // Find the organization by email
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('id, org_email, otp_verified')
      .eq('org_email', orgEmail)
      .single();

    if (orgError || !organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Check if already verified
    if (organization.otp_verified) {
      return NextResponse.json(
        { error: 'Organization email is already verified' },
        { status: 400 }
      );
    }

    // Generate new OTP
    const emailOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now

    // Update organization with new OTP
    const { error: updateError } = await supabase
      .from('organizations')
      .update({
        otp: emailOtp,
        otp_expires_at: otpExpiry.toISOString()
      })
      .eq('id', organization.id);

    if (updateError) {
      console.error('Error updating organization OTP:', updateError);
      return NextResponse.json(
        { error: 'Failed to generate new OTP' },
        { status: 500 }
      );
    }

    // Send OTP email
    const emailSent = await OTPService.sendOTP(orgEmail, emailOtp, 'registration');
    
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
    console.error('Error in org-resend-otp:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}