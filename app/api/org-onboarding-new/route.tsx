import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
// import { supabase } from '@/app/db/connections';
import { db, organizations, departments, eq, inArray } from '@/lib/db-helper';
import { OTPService } from '@/lib/otpService';

// Temporary storage for pending registrations (in production, use Redis or database temp table)
// Use global to persist across hot reloads in development
const globalForPendingRegs = global as typeof global & {
  pendingRegistrations?: Map<string, any>;
};

if (!globalForPendingRegs.pendingRegistrations) {
  globalForPendingRegs.pendingRegistrations = new Map();
}

const pendingRegistrations = globalForPendingRegs.pendingRegistrations;

interface OnboardingRequest {
  organizationName: string;
  domain: string;
  username: string;
  orgEmail: string;
  password: string;
  mobileNumber?: string;
  selectedDepartments?: string[]; // Array of department IDs
  logoUrl?: string;
  address?: string;
  taxPercentage?: number;
  gstNumber?: string;
  cin?: string;
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
      selectedDepartments = [],
      logoUrl,
      address,
      taxPercentage,
      gstNumber,
      cin
    } = body;

    // Validate required fields
    if (!organizationName || !username || !orgEmail || !password) {
      return NextResponse.json(
        { error: 'Organization name, username, email, and password are required' },
        { status: 400 }
      );
    }

    // Check if username already exists in actual organizations table
    const existingUsernameResults = await db.select({ username: organizations.username })
      .from(organizations)
      .where(eq(organizations.username, username))
      .limit(1);

    if (existingUsernameResults.length > 0) {
      return NextResponse.json({ 
        error: 'Username already exists' 
      }, { status: 409 });
    }

    // Check if org email already exists in actual organizations table
    const existingEmailResults = await db.select({ orgEmail: organizations.orgEmail })
      .from(organizations)
      .where(eq(organizations.orgEmail, orgEmail))
      .limit(1);

    if (existingEmailResults.length > 0) {
      return NextResponse.json({ 
        error: 'Organization email already exists' 
      }, { status: 409 });
    }

    // Validate selected departments exist (if any provided)
    if (selectedDepartments.length > 0) {
      const deptResults = await db.select({ id: departments.id })
        .from(departments)
        .where(inArray(departments.id, selectedDepartments));

      if (!deptResults || deptResults.length !== selectedDepartments.length) {
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
      logoUrl,
      address,
      taxPercentage,
      gstNumber,
      cin,
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