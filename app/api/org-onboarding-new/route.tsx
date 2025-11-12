import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabase } from '@/app/db/connections';
import { OTPService } from '@/lib/otpService';

// Temporary storage for pending registrations (in production, use Redis or database temp table)
const pendingRegistrations = new Map();

interface OnboardingRequest {
  organizationName: string;
  domain: string;
  username: string;
  orgEmail: string;
  password: string;
  mobileNumber?: string;
  selectedDepartments?: string[]; // Array of department IDs
}

export async function POST(req: NextRequest) {
  try {
    const body: OnboardingRequest = await req.json();
    
    const {
      organizationName,
      domain,
      username,
      orgEmail,
      password,
      mobileNumber,
      selectedDepartments = []
    } = body;

    // Validate required fields
    if (!organizationName || !username || !orgEmail || !password) {
      return NextResponse.json(
        { error: 'Organization name, username, email, and password are required' },
        { status: 400 }
      );
    }

    // Check if username already exists in actual organizations table
    const { data: existingUsername } = await supabase
      .from('organizations')
      .select('username')
      .eq('username', username)
      .single();

    if (existingUsername) {
      return NextResponse.json({ 
        error: 'Username already exists' 
      }, { status: 409 });
    }

    // Check if org email already exists in actual organizations table
    const { data: existingEmail } = await supabase
      .from('organizations')
      .select('org_email')
      .eq('org_email', orgEmail)
      .single();

    if (existingEmail) {
      return NextResponse.json({ 
        error: 'Organization email already exists' 
      }, { status: 409 });
    }

    // Validate selected departments exist (if any provided)
    if (selectedDepartments.length > 0) {
      const { data: departments, error: deptError } = await supabase
        .from('departments')
        .select('id')
        .in('id', selectedDepartments);

      if (deptError || !departments || departments.length !== selectedDepartments.length) {
        return NextResponse.json({ 
          error: 'One or more selected departments do not exist' 
        }, { status: 400 });
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Generate OTP
    const emailOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now

    // Store registration data temporarily (with OTP)
    const registrationId = `reg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    pendingRegistrations.set(registrationId, {
      organizationName,
      domain,
      username,
      orgEmail,
      passwordHash,
      mobileNumber,
      selectedDepartments,
      otp: emailOtp,
      otpExpiresAt,
      createdAt: new Date()
    });

    // Clean up expired registrations (older than 30 minutes)
    const now = new Date();
    for (const [key, value] of pendingRegistrations.entries()) {
      if (now.getTime() - value.createdAt.getTime() > 30 * 60 * 1000) {
        pendingRegistrations.delete(key);
      }
    }

    // Send OTP email
    const emailSent = await OTPService.sendOTP(orgEmail, emailOtp, 'registration');
    
    if (!emailSent) {
      // Clean up temp registration if email fails
      pendingRegistrations.delete(registrationId);
      return NextResponse.json({ 
        error: 'Failed to send verification email. Please try again.' 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Verification email sent. Please check your email for the OTP code.',
      registrationId: registrationId,
      orgEmail: orgEmail,
      requiresVerification: true
    }, { status: 200 });

  } catch (error) {
    console.error('Error in org-onboarding:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Export the pending registrations for use in verification
export { pendingRegistrations };