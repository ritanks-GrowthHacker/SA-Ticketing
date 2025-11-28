import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
// import { supabase } from "@/app/db/connections";
import { db, users, eq } from "@/lib/db-helper";
import crypto from "crypto";
import { emailService } from "@/lib/emailService";

interface JWTPayload {
  sub: string;        // user ID
  org_id: string;     // organization ID
  org_name: string;   // organization name
  org_domain: string; // organization domain
  role: string;       // user role
  roles: string[];    // all user roles
  iat?: number;
  exp?: number;
}

// Generate 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(req: Request) {
  try {
    // Get JWT token from authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authorization token is required" }, 
        { status: 401 }
      );
    }

    const token = authHeader.split(" ")[1];
    let decodedToken: JWTPayload;

    try {
      decodedToken = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    } catch (jwtError) {
      console.error("JWT verification error:", jwtError);
      return NextResponse.json(
        { error: "Invalid or expired token" }, 
        { status: 401 }
      );
    }

    // Get user email
    const user = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email
      })
      .from(users)
      .where(eq(users.id, decodedToken.sub))
      .limit(1)
      .then(rows => rows[0] || null);

    if (!user) {
      console.error("User fetch error");
      return NextResponse.json(
        { error: "User not found" }, 
        { status: 404 }
      );
    }

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    console.log(`🔐 Generated OTP for ${user.email}: ${otp} (expires at ${expiresAt})`);

    // Store OTP in users table
    try {
      await db
        .update(users)
        .set({
          otp: otp,
          otpExpiresAt: expiresAt
        })
        .where(eq(users.id, user.id));
    } catch (e) {
      console.log("⚠️ Failed to store OTP");
    }

    // Send OTP email using the email service
    console.log(`📧 Sending OTP email to ${user.email}...`);
    
    try {
      const emailResult = await emailService.sendPasswordChangeOTP(
        user.email,
        user.name || 'User',
        otp
      );

      if (emailResult.success) {
        console.log(`✅ OTP email sent successfully to ${user.email}`);
        console.log(`🔐 OTP: ${otp} (for development - expires in 10 minutes)`);
        
        return NextResponse.json({
          success: true,
          message: "OTP has been sent to your email address. Please check your inbox.",
          // For development only - remove in production
          debug: process.env.NODE_ENV === 'development' ? {
            otp: otp,
            email: user.email,
            expiresIn: "10 minutes"
          } : undefined
        }, { status: 200 });
      } else {
        console.error("❌ Failed to send OTP email:", emailResult.error);
        
        // Still return success with console OTP for development
        console.log(`🔐 Email failed, but OTP generated: ${otp} (for development)`);
        
        return NextResponse.json({
          success: true,
          message: "OTP generated. Check console for development OTP.",
          // For development fallback
          debug: process.env.NODE_ENV === 'development' ? {
            otp: otp,
            email: user.email,
            expiresIn: "10 minutes",
            emailError: emailResult.error
          } : undefined
        }, { status: 200 });
      }
    } catch (emailError) {
      console.error("❌ Email service error:", emailError);
      
      // Return success with console OTP for development
      console.log(`🔐 Email service failed, but OTP generated: ${otp} (for development)`);
      
      return NextResponse.json({
        success: true,
        message: "OTP generated. Please check console for development OTP.",
        // For development fallback
        debug: process.env.NODE_ENV === 'development' ? {
          otp: otp,
          email: user.email,
          expiresIn: "10 minutes"
        } : undefined
      }, { status: 200 });
    }

  } catch (error) {
    console.error("Send OTP error:", error);
    return NextResponse.json(
      { error: "Internal server error" }, 
      { status: 500 }
    );
  }
}