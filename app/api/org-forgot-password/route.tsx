import { NextResponse } from "next/server";
import { db, organizations, eq } from '@/lib/db-helper';
import { emailService } from "@/lib/emailService";

// Generate 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(req: Request) {
  try {
    // Parse request body
    let body: { email?: string; username?: string };
    try {
      body = await req.json();
    } catch (parseError) {
      return NextResponse.json(
        { error: "Invalid request body" }, 
        { status: 400 }
      );
    }

    // Validate input - accept either email or username
    if (!body.email && !body.username) {
      return NextResponse.json(
        { error: "Email or username is required" }, 
        { status: 400 }
      );
    }

    console.log(`🔐 Organization password reset requested for:`, body);

    // Find organization by email or username
    let organization;
    
    if (body.email) {
      const email = body.email.toLowerCase().trim();
      const orgResults = await db.select({
        id: organizations.id,
        name: organizations.name,
        orgEmail: organizations.orgEmail,
        username: organizations.username
      })
        .from(organizations)
        .where(eq(organizations.orgEmail, email))
        .limit(1);
      
      organization = orgResults[0];
    } else if (body.username) {
      const username = body.username.toLowerCase().trim();
      const orgResults = await db.select({
        id: organizations.id,
        name: organizations.name,
        orgEmail: organizations.orgEmail,
        username: organizations.username
      })
        .from(organizations)
        .where(eq(organizations.username, username))
        .limit(1);
      
      organization = orgResults[0];
    }

    if (!organization) {
      console.log(`❌ Password reset attempted for non-existent organization`);
      // Don't reveal that the organization doesn't exist for security
      return NextResponse.json(
        { 
          success: true, 
          message: "If an organization with this email/username exists, you will receive a password reset OTP." 
        }, 
        { status: 200 }
      );
    }

    if (!organization.orgEmail) {
      console.log(`❌ Organization ${organization.name} has no email configured`);
      return NextResponse.json(
        { 
          success: true, 
          message: "If an organization with this email/username exists, you will receive a password reset OTP." 
        }, 
        { status: 200 }
      );
    }

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    console.log(`🔐 Generated password reset OTP for organization ${organization.name}: ${otp} (expires at ${expiresAt})`);

    // Store OTP in the organizations table
    // Convert to local timezone timestamp for database compatibility
    const localExpiryTime = new Date(expiresAt.getTime() - (expiresAt.getTimezoneOffset() * 60000));
    
    console.log(`🔍 Storage Debug:`);
    console.log(`   Original Expiry: ${expiresAt.toISOString()}`);
    console.log(`   Local Expiry: ${localExpiryTime.toISOString()}`);
    console.log(`   Timezone Offset: ${expiresAt.getTimezoneOffset()} minutes`);
    
    try {
      await db.update(organizations)
        .set({ 
          otp: otp,
          otpExpiresAt: localExpiryTime,
          otpVerified: false,
          updatedAt: new Date()
        })
        .where(eq(organizations.id, organization.id));
        
      console.log(`✅ OTP stored in organizations table for ${organization.name}`);
    } catch (e) {
      console.error("Error storing OTP in organizations table:", e);
      return NextResponse.json(
        { error: "Failed to process password reset request" }, 
        { status: 500 }
      );
    }

    // Send OTP email using the email service
    console.log(`📧 Sending password reset OTP email to ${organization.orgEmail}...`);
    
    try {
      const emailResult = await emailService.sendPasswordChangeOTP(
        organization.orgEmail,
        organization.name || 'Organization',
        otp
      );

      if (emailResult.success) {
        console.log(`✅ Password reset OTP email sent successfully to ${organization.orgEmail}`);
        return NextResponse.json({
          success: true,
          message: "Password reset OTP sent to your organization email address.",
          email: organization.orgEmail // Return email for OTP verification screen
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
    console.error("💥 Organization forgot password API error:", error);
    return NextResponse.json(
      { error: "Internal server error" }, 
      { status: 500 }
    );
  }
}
