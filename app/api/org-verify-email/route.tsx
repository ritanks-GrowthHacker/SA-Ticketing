import { NextRequest, NextResponse } from 'next/server';
// import { supabase } from '@/app/db/connections';
import { db, organizations, eq } from '@/lib/db-helper';

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
    const orgResults = await db.select({
      id: organizations.id,
      orgEmail: organizations.orgEmail,
      otp: organizations.otp,
      otpExpiresAt: organizations.otpExpiresAt,
      otpVerified: organizations.otpVerified
    })
      .from(organizations)
      .where(eq(organizations.orgEmail, orgEmail))
      .limit(1);
    
    const organization = orgResults[0] || null;

    console.log('Organization lookup:', { orgEmail, organization });

    if (!organization) {
      console.error('Organization not found');
      return NextResponse.json(
        { 
          error: 'Organization not found',
          debug: {
            email: orgEmail,
            foundData: 'Not found'
          }
        },
        { status: 404 }
      );
    }

    // Check if already verified
    if (organization.otpVerified) {
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
    if (organization.otpExpiresAt) {
      const otpExpiry = new Date(organization.otpExpiresAt);
      if (now > otpExpiry) {
        return NextResponse.json(
          { error: 'OTP has expired. Please request a new verification email.' },
          { status: 400 }
        );
      }
    }

    // Update organization to mark as verified and clear OTP data
    try {
      await db.update(organizations)
        .set({
          otpVerified: true,
          otp: null,
          otpExpiresAt: null,
          isActive: true  // Activate the organization
        })
        .where(eq(organizations.id, organization.id));
    } catch (updateError) {
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