import { NextResponse } from "next/server";
// import { supabase } from "@/app/db/connections";
import { db, users, eq } from '@/lib/db-helper';
import crypto from "crypto";
import { emailService } from "@/lib/emailService";

// Generate 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(req: Request) {
  try {
    // Parse request body
    let body: { email: string };
    try {
      body = await req.json();
    } catch (parseError) {
      return NextResponse.json(
        { error: "Invalid request body" }, 
        { status: 400 }
      );
    }

    // Validate input
    if (!body.email) {
      return NextResponse.json(
        { error: "Email is required" }, 
        { status: 400 }
      );
    }

    const email = body.email.toLowerCase().trim();

    // Check if user exists
    const userResults = await db.select({
      id: users.id,
      name: users.name,
      email: users.email
    })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    
    const user = userResults[0];

    if (!user) {
      console.log(`❌ Password reset attempted for non-existent email: ${email}`);
      // Don't reveal that the email doesn't exist for security
      return NextResponse.json(
        { 
          success: true, 
          message: "If an account with this email exists, you will receive a password reset OTP." 
        }, 
        { status: 200 }
      );
    }

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    console.log(`🔐 Generated password reset OTP for ${user.email}: ${otp} (expires at ${expiresAt})`);

    // Store OTP in the users table using existing otp and otp_expires_at columns
    // Convert to local timezone timestamp for database compatibility
    const localExpiryTime = new Date(expiresAt.getTime() - (expiresAt.getTimezoneOffset() * 60000));
    
    console.log(`🔍 Storage Debug:`);
    console.log(`   Original Expiry: ${expiresAt.toISOString()}`);
    console.log(`   Local Expiry: ${localExpiryTime.toISOString()}`);
    console.log(`   Timezone Offset: ${expiresAt.getTimezoneOffset()} minutes`);
    
    try {
      await db.update(users)
        .set({ 
          otp: otp,
          otpExpiresAt: localExpiryTime,
          otpVerified: false,
          updatedAt: new Date()
        })
        .where(eq(users.id, user.id));
        
      console.log(`✅ OTP stored in users table for ${user.email}`);
    } catch (e) {
      console.error("Error storing OTP in users table:", e);
      return NextResponse.json(
        { error: "Failed to process password reset request" }, 
        { status: 500 }
      );
    }

    // Send OTP email using the email service
    console.log(`📧 Sending password reset OTP email to ${user.email}...`);
    
    try {
      const emailResult = await emailService.sendPasswordChangeOTP(
        user.email,
        user.name || 'User',
        otp
      );

      if (emailResult.success) {
        console.log(`✅ Password reset OTP email sent successfully to ${user.email}`);
        return NextResponse.json({
          success: true,
          message: "Password reset OTP sent to your email address."
        }, { status: 200 });
      } else {
        console.error("❌ Failed to send password reset OTP email:", emailResult.error);
        return NextResponse.json(
          { error: "Failed to send password reset email" }, 
          { status: 500 }
        );
      }
    } catch (emailError) {
      console.error("❌ Email service error:", emailError);
      return NextResponse.json(
        { error: "Failed to send password reset email" }, 
        { status: 500 }
      );
    }

  } catch (error) {
    console.error("💥 Forgot password API error:", error);
    return NextResponse.json(
      { error: "Internal server error" }, 
      { status: 500 }
    );
  }
}