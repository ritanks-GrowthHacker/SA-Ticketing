import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/db/connections';
import { OTPService } from '@/lib/otpService';

interface ResendLoginOTPRequest {
  orgId: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orgId }: ResendLoginOTPRequest = body;

    // Validate required fields
    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    // Get organization from database
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .single();

    if (orgError || !organization) {
      return NextResponse.json(
        { error: 'Organization not found with this email' },
        { status: 404 }
      );
    }

    // Check if organization is active
    if (!organization.is_active) {
      return NextResponse.json(
        { error: 'Organization account is not active' },
        { status: 400 }
      );
    }

    // Generate new OTP
    const newOtp = OTPService.generateOTP();
    const otpExpiry = OTPService.getExpiryTime();

    // Update organization with new OTP
    await supabase
      .from('organizations')
      .update({ 
        otp: newOtp,
        otp_expires_at: otpExpiry.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', organization.id);

    // Send OTP email
    try {
      const emailSent = await OTPService.sendOTP(organization.org_email, newOtp, 'login');
      
      if (!emailSent) {
        return NextResponse.json(
          { error: 'Failed to send OTP email. Please try again.' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'New OTP sent to your organization email'
      }, { status: 200 });

    } catch (emailError) {
      console.error('Error sending OTP email:', emailError);
      return NextResponse.json(
        { error: 'Failed to send OTP email. Please try again.' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Resend login OTP error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}