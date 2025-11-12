import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabase } from '@/app/db/connections';
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
    const { data: existingDomain } = await supabase
      .from('organizations')
      .select('id')
      .eq('domain', domain)
      .maybeSingle();

    if (existingDomain) {
      return NextResponse.json(
        { error: 'An organization with this domain already exists' },
        { status: 409 }
      );
    }

    // Check if username already exists (now that column exists)
    const { data: existingUsername } = await supabase
      .from('organizations')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (existingUsername) {
      return NextResponse.json(
        { error: 'This username is already taken' },
        { status: 409 }
      );
    }

    // Check if org email already exists
    const { data: existingOrgEmail } = await supabase
      .from('organizations')
      .select('id')
      .eq('org_email', orgEmail)
      .maybeSingle();

    if (existingOrgEmail) {
      return NextResponse.json(
        { error: 'An organization with this email already exists' },
        { status: 409 }
      );
    }

    // Validate selected departments if provided
    if (selectedDepartments.length > 0) {
      const { data: validDepartments } = await supabase
        .from('departments')
        .select('id')
        .in('id', selectedDepartments);
      
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
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .insert([
        {
          name: organizationName,
          domain: domain,
          username: username,
          password_hash: passwordHash,
          org_email: orgEmail,
          mobile_number: mobileNumber || null,
          otp: emailOtp,
          otp_expires_at: otpExpiresAt.toISOString(),
          otp_verified: false,
          mobile_verified: false,
          is_active: false,
          associated_departments: selectedDepartments
        }
      ])
      .select()
      .single();

    if (orgError) {
      console.error('🔴 Organization creation error:', orgError);
      console.error('🔴 Error details:', JSON.stringify(orgError, null, 2));
      return NextResponse.json(
        { error: 'Failed to create organization. Database error: ' + orgError.message },
        { status: 500 }
      );
    }

    // Send OTP email for verification
    const emailSent = await OTPService.sendOTP(orgEmail, emailOtp, 'registration');
    
    if (!emailSent) {
      // Clean up organization if email fails
      await supabase.from('organizations').delete().eq('id', organization.id);
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