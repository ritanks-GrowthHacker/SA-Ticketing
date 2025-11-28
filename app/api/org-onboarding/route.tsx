import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
// import { supabase } from '@/app/db/connections';
import { db, organizations, departments, eq, inArray } from '@/lib/db-helper';
import { OTPService } from '@/lib/otpService';

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
    if (!organizationName || !domain || !username || !orgEmail || !password) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(orgEmail)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate domain format
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(domain)) {
      return NextResponse.json(
        { error: 'Invalid domain format' },
        { status: 400 }
      );
    }

    // Validate password strength
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(password)) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters with uppercase, lowercase, and number' },
        { status: 400 }
      );
    }

    // Check if domain already exists
    const existingDomainResults = await db.select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.domain, domain))
      .limit(1);

    if (existingDomainResults.length > 0) {
      return NextResponse.json(
        { error: 'An organization with this domain already exists' },
        { status: 409 }
      );
    }

    // Check if username already exists (now that column exists)
    const existingUsernameResults = await db.select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.username, username))
      .limit(1);

    if (existingUsernameResults.length > 0) {
      return NextResponse.json(
        { error: 'This username is already taken' },
        { status: 409 }
      );
    }

    // Check if org email already exists
    const existingOrgEmailResults = await db.select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.orgEmail, orgEmail))
      .limit(1);

    if (existingOrgEmailResults.length > 0) {
      return NextResponse.json(
        { error: 'An organization with this email already exists' },
        { status: 409 }
      );
    }

    // Validate selected departments if provided
    if (selectedDepartments.length > 0) {
      const validDepartments = await db.select({ id: departments.id })
        .from(departments)
        .where(inArray(departments.id, selectedDepartments));
      
      if (!validDepartments || validDepartments.length !== selectedDepartments.length) {
        return NextResponse.json(
          { error: 'One or more selected departments are invalid' },
          { status: 400 }
        );
      }
    }

    // Hash the password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Generate OTP for email verification
    const emailOtp = OTPService.generateOTP();
    const otpExpiresAt = OTPService.getExpiryTime();

    console.log('Organization Registration OTP:', {
      orgEmail,
      generatedOTP: emailOtp,
      expiryTime: otpExpiresAt.toISOString()
    });

    // Create the organization with all required fields
    let organization;
    try {
      const newOrgs = await db.insert(organizations)
        .values({
          name: organizationName,
          domain: domain,
          username: username,
          passwordHash: passwordHash,
          orgEmail: orgEmail,
          mobileNumber: mobileNumber || null,
          otp: emailOtp,
          otpExpiresAt: otpExpiresAt,
          otpVerified: false,
          mobileVerified: false,
          isActive: false,
          associatedDepartments: selectedDepartments || []
        })
        .returning();
      
      organization = newOrgs[0];
    } catch (orgError) {
      console.error('🔴 Organization creation error:', orgError);
      return NextResponse.json(
        { error: 'Failed to create organization. Database error: ' + (orgError as Error).message },
        { status: 500 }
      );
    }

    // Send OTP email for verification
    const emailSent = await OTPService.sendOTP(orgEmail, emailOtp, 'registration');
    
    if (!emailSent) {
      // Clean up organization if email fails
      await db.delete(organizations).where(eq(organizations.id, organization.id));
      return NextResponse.json({ 
        error: 'Failed to send verification email. Please try again.' 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Organization created successfully. Please check your email for verification code.',
      organizationId: organization.id,
      requiresVerification: true,
      orgEmail: orgEmail
    }, { status: 201 });

  } catch (error) {
    console.error('Organization onboarding error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}