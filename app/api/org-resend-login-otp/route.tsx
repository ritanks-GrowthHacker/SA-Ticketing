import { NextRequest, NextResponse } from 'next/server';
// import { supabase } from '@/app/db/connections';
import { db, organizations, eq } from '@/lib/db-helper';
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
    const orgResults = await db.select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);
    
    const organization = orgResults[0] || null;

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found with this email' },
        { status: 404 }
      );
    }

    // Check if organization is active
    if (!organization.isActive) {
      return NextResponse.json(
        { error: 'Organization account is not active' },
        { status: 400 }
      );
    }

    // Generate new OTP
    const newOtp = OTPService.generateOTP();
    const otpExpiry = OTPService.getExpiryTime();

    // Update organization with new OTP
    await db.update(organizations)
      .set({ 
        otp: newOtp,
        otpExpiresAt: otpExpiry,
        updatedAt: new Date()
      })
      .where(eq(organizations.id, organization.id));

    // Send OTP email
    try {
      const emailSent = await OTPService.sendOTP(organization.orgEmail || '', newOtp, 'login');
      
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