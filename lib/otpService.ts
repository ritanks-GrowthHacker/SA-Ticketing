// OTP Service for generating and validating OTPs
import { emailService } from './emailService';

export class OTPService {
  // Generate a 6-digit OTP
  static generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Calculate OTP expiry time (5 minutes from now)
  static getExpiryTime(): Date {
    const now = new Date();
    return new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes
  }

  // Send OTP via email
  static async sendOTP(email: string, otp: string, type: 'registration' | 'login'): Promise<boolean> {
    try {
      const subject = type === 'registration' 
        ? 'Complete Your Registration - OTP Code'
        : 'Login OTP - Access Code';

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>OTP Verification - Ticketing Metrix</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #4F46E5;">Ticketing Metrix</h1>
            </div>
            
            <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; text-align: center;">
              <h2 style="color: #333; margin-bottom: 20px;">
                ${type === 'registration' ? 'Complete Your Registration' : 'Login Access Code'}
              </h2>
              
              <p style="font-size: 16px; margin-bottom: 30px;">
                ${type === 'registration' 
                  ? 'Thank you for registering with Ticketing Metrix! Please use the OTP below to complete your registration.'
                  : 'Please use the OTP below to complete your login.'
                }
              </p>
              
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h1 style="font-size: 36px; letter-spacing: 8px; color: #4F46E5; margin: 0;">
                  ${otp}
                </h1>
              </div>
              
              <p style="color: #666; font-size: 14px;">
                This OTP will expire in 5 minutes. Please do not share this code with anyone.
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px; color: #666; font-size: 12px;">
              <p>If you didn't request this OTP, please ignore this email.</p>
              <p>&copy; 2025 Ticketing Metrix. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const result = await emailService.sendEmail({
        to: email,
        subject,
        html: emailHtml
      });

      return result.success;
    } catch (error) {
      console.error('Failed to send OTP:', error);
      return false;
    }
  }

  // Validate OTP and check expiry
  static isOTPValid(storedOTP: string, providedOTP: string, expiryTime: Date): boolean {
    if (!storedOTP || !providedOTP) return false;
    
    const now = new Date();
    if (now > expiryTime) return false;
    
    return storedOTP === providedOTP;
  }
}