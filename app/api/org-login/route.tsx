import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
// import { supabase } from '@/app/db/connections';
import { db, organizations, eq } from '@/lib/db-helper';
import { OTPService } from '@/lib/otpService';

interface LoginRequest {
  username: string;
  password: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: LoginRequest = await req.json();
    
    const { username, password } = body;

    // Validate required fields
    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Find organization by username with password hash
    const orgResults = await db.select()
      .from(organizations)
      .where(eq(organizations.username, username))
      .limit(1);
    
    const organization = orgResults[0] || null;

    if (!organization) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    // Check if organization is active
    if (!organization.isActive) {
      return NextResponse.json(
        { error: 'Organization account is not active. Please contact support.' },
        { status: 401 }
      );
    }

    // Check if email is verified
    if (!organization.otpVerified) {
      return NextResponse.json(
        { error: 'Please verify your organization email before logging in.' },
        { status: 401 }
      );
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, organization.passwordHash || '');
    if (!passwordMatch) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    // Generate JWT token for organization
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('JWT_SECRET is not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const tokenPayload = {
      sub: organization.id,
      org_id: organization.id,
      org_name: organization.name,
      org_domain: organization.domain,
      org_email: organization.orgEmail,
      username: organization.username,
      type: 'organization',
      iss: 'sa-ticketing-org',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
    };

    const token = jwt.sign(tokenPayload, jwtSecret);

    // Generate OTP for login verification
    const otp = OTPService.generateOTP();
    const otpExpiry = OTPService.getExpiryTime();

    // Update organization with OTP and last login timestamp
    await db.update(organizations)
      .set({ 
        otp: otp,
        otpExpiresAt: otpExpiry,
        updatedAt: new Date()
      })
      .where(eq(organizations.id, organization.id));

    // Send OTP email to organization email
    try {
      const emailSent = await OTPService.sendOTP(organization.orgEmail || '', otp, 'login');
      if (!emailSent) {
        console.error('Failed to send OTP email to organization:', organization.orgEmail);
      }
    } catch (emailError) {
      console.error('Error sending OTP email:', emailError);
      // Don't fail the login if email fails, but log it
    }

    // Return success response with token and organization info
    return NextResponse.json({
      success: true,
      message: 'Login successful! OTP sent to your organization email.',
      token,
      organization: {
        id: organization.id,
        name: organization.name,
        domain: organization.domain,
        email: organization.orgEmail,
        onboarding_completed: !!organization.onboardedAt, // true if onboarded_at is not null
        has_departments: !!(organization.associatedDepartments && organization.associatedDepartments.length > 0),
        created_at: organization.createdAt
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Organization login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}