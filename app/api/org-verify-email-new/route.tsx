import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/db/connections';
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
    const { data: existingUsername } = await supabase
      .from('organizations')
      .select('username')
      .eq('username', pendingReg.username)
      .single();

    if (existingUsername) {
      pendingRegistrations.delete(registrationId);
      return NextResponse.json({ 
        error: 'Username was taken by another registration. Please start again with a different username.' 
      }, { status: 409 });
    }

    const { data: existingEmail } = await supabase
      .from('organizations')
      .select('org_email')
      .eq('org_email', pendingReg.orgEmail)
      .single();

    if (existingEmail) {
      pendingRegistrations.delete(registrationId);
      return NextResponse.json({ 
        error: 'Email was taken by another registration. Please start again with a different email.' 
      }, { status: 409 });
    }

    // Create the organization record
    const { data: organization, error: createError } = await supabase
      .from('organizations')
      .insert({
        name: pendingReg.organizationName,
        domain: pendingReg.domain,
        username: pendingReg.username,
        password_hash: pendingReg.passwordHash,
        org_email: pendingReg.orgEmail,
        mobile_number: pendingReg.mobileNumber,
        associated_departments: pendingReg.selectedDepartments,
        otp_verified: true,  // Already verified
        is_active: true,     // Activate immediately
        onboarded_at: new Date().toISOString()
      })
      .select('id, name, username, org_email')
      .single();

    if (createError) {
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
        org_email: organization.org_email
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