import { NextRequest, NextResponse } from 'next/server';
// import { supabase } from '@/app/db/connections';
import { db, organizations, eq } from '@/lib/db-helper';
import { pendingRegistrations } from '../org-onboarding-new/route';

interface VerifyOTPRequest {
  registrationId: string;
  orgEmail: string;
  otp: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { registrationId, orgEmail, otp }: VerifyOTPRequest = body;

    // Validate required fields
    if (!registrationId || !orgEmail || !otp) {
      return NextResponse.json(
        { error: 'Registration ID, email and OTP are required' },
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

    // Check if OTP matches
    if (pendingReg.otp !== otp) {
      return NextResponse.json(
        { error: 'Invalid OTP code' },
        { status: 400 }
      );
    }

    // Check if OTP has expired
    const now = new Date();
    if (now > pendingReg.otpExpiresAt) {
      // Clean up expired registration
      pendingRegistrations.delete(registrationId);
      return NextResponse.json(
        { error: 'OTP has expired. Please start registration again.' },
        { status: 400 }
      );
    }

    // Double-check that username and email are still available (race condition protection)
    const existingUsernameResults = await db.select({ username: organizations.username })
      .from(organizations)
      .where(eq(organizations.username, pendingReg.username))
      .limit(1);

    if (existingUsernameResults.length > 0) {
      pendingRegistrations.delete(registrationId);
      return NextResponse.json({ 
        error: 'Username was taken by another registration. Please start again with a different username.' 
      }, { status: 409 });
    }

    const existingEmailResults = await db.select({ orgEmail: organizations.orgEmail })
      .from(organizations)
      .where(eq(organizations.orgEmail, pendingReg.orgEmail))
      .limit(1);

    if (existingEmailResults.length > 0) {
      pendingRegistrations.delete(registrationId);
      return NextResponse.json({ 
        error: 'Email was taken by another registration. Please start again with a different email.' 
      }, { status: 409 });
    }

    // Create the organization record
    let organization;
    try {
      const currentTime = new Date();
      const newOrgs = await db.insert(organizations)
        .values({
          name: pendingReg.organizationName,
          domain: pendingReg.domain,
          username: pendingReg.username,
          passwordHash: pendingReg.passwordHash,
          orgEmail: pendingReg.orgEmail,
          mobileNumber: pendingReg.mobileNumber || null,
          associatedDepartments: pendingReg.selectedDepartments,
          logoUrl: pendingReg.logoUrl || null,
          address: pendingReg.address || null,
          taxPercentage: pendingReg.taxPercentage || '0.00',
          gstNumber: pendingReg.gstNumber || null,
          cin: pendingReg.cin || null,
          otpVerified: true,  // Already verified
          isActive: true,     // Activate immediately
          onboardedAt: currentTime
        })
        .returning({ id: organizations.id, name: organizations.name, username: organizations.username, orgEmail: organizations.orgEmail });
      
      organization = newOrgs[0];
    } catch (createError) {
      console.error('Error creating organization:', createError);
      return NextResponse.json(
        { error: 'Failed to create organization. Please try again.' },
        { status: 500 }
      );
    }

    // Clean up pending registration
    pendingRegistrations.delete(registrationId);

    return NextResponse.json({
      success: true,
      message: 'Organization verified and created successfully. You can now login.',
      organization: {
        id: organization.id,
        name: organization.name,
        username: organization.username,
        org_email: organization.orgEmail
      },
      verified: true
    }, { status: 201 });

  } catch (error) {
    console.error('Error in org-verify-email-new:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}