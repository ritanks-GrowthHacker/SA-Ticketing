import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/db/connections';

interface VerifyOTPRequest {
  orgEmail: string;
  otp: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orgEmail, otp }: VerifyOTPRequest = body;

    // Validate required fields
    if (!orgEmail || !otp) {
      return NextResponse.json(
        { error: 'Organization email and OTP are required' },
        { status: 400 }
      );
    }

    // Find the organization by email
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('id, org_email, otp, otp_expires_at, otp_verified')
      .eq('org_email', orgEmail)
      .single();

    console.log('Organization lookup:', { orgEmail, organization, orgError });

    if (orgError || !organization) {
      console.error('Organization not found:', orgError);
      return NextResponse.json(
        { 
          error: 'Organization not found',
          debug: {
            email: orgEmail,
            dbError: orgError?.message || 'No error',
            foundData: organization ? 'Found' : 'Not found'
          }
        },
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

    // Check if OTP matches
    if (organization.otp !== otp) {
      return NextResponse.json(
        { error: 'Invalid OTP code' },
        { status: 400 }
      );
    }

    // Check if OTP has expired
    const now = new Date();
    if (organization.otp_expires_at) {
      const otpExpiry = new Date(organization.otp_expires_at);
      if (now > otpExpiry) {
        return NextResponse.json(
          { error: 'OTP has expired. Please request a new verification email.' },
          { status: 400 }
        );
      }
    }

    // Update organization to mark as verified and clear OTP data
    const { error: updateError } = await supabase
      .from('organizations')
      .update({
        otp_verified: true,
        otp: null,
        otp_expires_at: null,
        is_active: true  // Activate the organization
      })
      .eq('id', organization.id);

    if (updateError) {
      console.error('Error updating organization:', updateError);
      return NextResponse.json(
        { error: 'Failed to verify organization. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Organization email verified successfully. You can now login.',
      verified: true
    });

  } catch (error) {
    console.error('Error in org-verify-email:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}