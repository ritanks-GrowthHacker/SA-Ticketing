import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/db/connections';

interface VerifyLoginOTPRequest {
  orgId: string;
  otp: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orgId, otp }: VerifyLoginOTPRequest = body;

    // Validate required fields
    if (!orgId || !otp) {
      return NextResponse.json(
        { error: 'Organization ID and OTP are required' },
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
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Check if organization has OTP
    if (!organization.otp) {
      return NextResponse.json(
        { error: 'No OTP found. Please try logging in again.' },
        { status: 400 }
      );
    }

    // Verify OTP matches
    if (organization.otp !== otp) {
      return NextResponse.json(
        { error: 'Invalid OTP code' },
        { status: 400 }
      );
    }

    // Check if OTP has expired
    const now = new Date();
    const otpExpiry = new Date(organization.otp_expires_at);
    
    if (now > otpExpiry) {
      // Clear expired OTP
      await supabase
        .from('organizations')
        .update({ 
          otp: null,
          otp_expires_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', orgId);

      return NextResponse.json(
        { error: 'OTP has expired. Please log in again to get a new OTP.' },
        { status: 400 }
      );
    }

    // OTP is valid - clear it and mark login as verified
    await supabase
      .from('organizations')
      .update({ 
        otp: null,
        otp_expires_at: null,
        otp_verified: true,  // Mark as verified if not already
        updated_at: new Date().toISOString()
      })
      .eq('id', orgId);

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'OTP verified successfully',
      organization: {
        id: organization.id,
        name: organization.name,
        domain: organization.domain,
        email: organization.org_email,
        onboarding_completed: organization.onboarding_completed || false,
        has_departments: !!(organization.associated_departments && organization.associated_departments.length > 0)
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Organization OTP verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}