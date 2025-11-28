import { NextRequest, NextResponse } from 'next/server';
// import { supabase } from '@/app/db/connections';
import { db, organizations, eq } from '@/lib/db-helper';

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
    const orgResults = await db.select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);
    
    const organization = orgResults[0] || null;

    if (!organization) {
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
    const otpExpiry = new Date(organization.otpExpiresAt || now);
    
    if (now > otpExpiry) {
      // Clear expired OTP
      await db.update(organizations)
        .set({ 
          otp: null,
          otpExpiresAt: null,
          updatedAt: new Date()
        })
        .where(eq(organizations.id, orgId));

      return NextResponse.json(
        { error: 'OTP has expired. Please log in again to get a new OTP.' },
        { status: 400 }
      );
    }

    // OTP is valid - clear it and mark login as verified
    await db.update(organizations)
      .set({ 
        otp: null,
        otpExpiresAt: null,
        otpVerified: true,  // Mark as verified if not already
        updatedAt: new Date()
      })
      .where(eq(organizations.id, orgId));

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'OTP verified successfully',
      organization: {
        id: organization.id,
        name: organization.name,
        domain: organization.domain,
        email: organization.orgEmail,
        has_departments: !!(organization.associatedDepartments && organization.associatedDepartments.length > 0)
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