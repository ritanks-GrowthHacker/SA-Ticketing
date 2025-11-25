import nodemailer from "nodemailer";
import { supabase } from "@/app/db/connections";

// Helper to get base URL for all email links
const getBaseUrl = () => process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

interface EmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

interface EmailConfig {
  service: string;
  user: string;
  pass: string;
}

class EmailService {
  private transporter: nodemailer.Transporter;
  private config: EmailConfig;

  constructor() {
    // Use environment variables for security
    this.config = {
      service: process.env.EMAIL_SERVICE || "gmail",
      user: process.env.EMAIL_USER || "",
      pass: process.env.EMAIL_PASS || "",
    };

    if (!this.config.user || !this.config.pass) {
      console.warn('⚠️ EMAIL_USER or EMAIL_PASS not set in environment variables');
    }

    this.transporter = nodemailer.createTransport({
      service: this.config.service,
      auth: {
        user: this.config.user,
        pass: this.config.pass,
      },
    });
  }

  async sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const mailOptions = {
        from: this.config.user,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: options.attachments,
      };

      const response = await this.transporter.sendMail(mailOptions);
      
      console.log("Email sent successfully:", response.messageId);
      return { 
        success: true, 
        messageId: response.messageId 
      };
    } catch (error) {
      console.error("Error sending email:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return { 
        success: false, 
        error: errorMessage 
      };
    }
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error("Email service verification failed:", error);
      return false;
    }
  }

  // Check if user has email notifications enabled
  async checkEmailPreference(userEmail: string): Promise<boolean> {
    try {
      const { data: user, error } = await supabase
        .from("users")
        .select("email_notifications_enabled")
        .eq("email", userEmail)
        .single();

      if (error) {
        console.error("Error checking email preference:", error);
        return true; // Default to sending emails if we can't check preference
      }

      return user?.email_notifications_enabled ?? true; // Default to true if not set
    } catch (error) {
      console.error("Error checking email preference:", error);
      return true; // Default to sending emails on error
    }
  }

  // Enhanced sendEmail method that checks user preferences
  async sendEmailWithPreferenceCheck(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string; skipped?: boolean }> {
    try {
      // Check if it's an array of recipients
      const recipients = Array.isArray(options.to) ? options.to : [options.to];
      const filteredRecipients: string[] = [];

      // Check each recipient's email preference
      for (const recipient of recipients) {
        const canSendEmail = await this.checkEmailPreference(recipient);
        if (canSendEmail) {
          filteredRecipients.push(recipient);
        } else {
          console.log(`📧 Skipping email to ${recipient} - notifications disabled`);
        }
      }

      // If no recipients have email notifications enabled, skip sending
      if (filteredRecipients.length === 0) {
        return { 
          success: true, 
          skipped: true,
          error: "All recipients have email notifications disabled" 
        };
      }

      // Send email to filtered recipients
      return this.sendEmail({
        ...options,
        to: filteredRecipients.length === 1 ? filteredRecipients[0] : filteredRecipients
      });

    } catch (error) {
      console.error("Error in sendEmailWithPreferenceCheck:", error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  // Predefined email templates
  async sendTeamAssignmentEmail(to: string, projectName: string, role: string, assigneeName: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Team Assignment Notification</h2>
        <p>Hi <strong>${assigneeName}</strong>,</p>
        <p>You have been assigned to the <strong>${projectName}</strong> project as a <strong>${role}</strong>.</p>
        <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <h3 style="margin: 0 0 8px 0;">Assignment Details:</h3>
          <ul style="margin: 0; padding-left: 20px;">
            <li>Project: ${projectName}</li>
            <li>Role: ${role}</li>
            <li>Status: Active</li>
          </ul>
        </div>
        <p>Please check your dashboard for more details about the project.</p>
        <p>Best regards,<br>Ticketing Metrix Team</p>
      </div>
    `;

    return this.sendEmailWithPreferenceCheck({
      to,
      subject: `Team Assignment - ${projectName}`,
      html,
      text: `Hi ${assigneeName}, You have been assigned to ${projectName} project as a ${role}.`
    });
  }

  async sendTicketNotificationEmail(to: string, ticketId: string, title: string, status: string, assigneeName: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Ticket Notification</h2>
        <p>Hi <strong>${assigneeName}</strong>,</p>
        <p>A ticket has been assigned to you or updated.</p>
        <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <h3 style="margin: 0 0 8px 0;">Ticket Details:</h3>
          <ul style="margin: 0; padding-left: 20px;">
            <li>Ticket ID: ${ticketId}</li>
            <li>Title: ${title}</li>
            <li>Status: ${status}</li>
          </ul>
        </div>
        <p>Please check your dashboard for more details.</p>
        <p>Best regards,<br>Ticketing Metrix Team</p>
      </div>
    `;

    return this.sendEmailWithPreferenceCheck({
      to,
      subject: `Ticket ${status} - ${ticketId}`,
      html,
      text: `Hi ${assigneeName}, Ticket ${ticketId} (${title}) is now ${status}.`
    });
  }

  // New email template for ticket assignment
  async sendTicketAssignmentEmail(
    to: string, 
    ticketId: string, 
    title: string, 
    description: string,
    projectName: string,
    assigneeName: string,
    createdBy: string,
    priority?: string,
    status?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">🎫 New Ticket Assigned</h1>
        </div>
        
        <div style="padding: 30px;">
          <p style="font-size: 16px; color: #333;">Hi <strong>${assigneeName}</strong>,</p>
          <p style="color: #666; line-height: 1.6;">You have been assigned a new ticket by <strong>${createdBy}</strong>. Please review the details below:</p>
          
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0; color: #2d3748; border-bottom: 2px solid #4299e1; padding-bottom: 8px;">📋 Ticket Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #4a5568; width: 120px;">Ticket ID:</td>
                <td style="padding: 8px 0; color: #2d3748;">#${ticketId}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #4a5568;">Title:</td>
                <td style="padding: 8px 0; color: #2d3748;">${title}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #4a5568;">Project:</td>
                <td style="padding: 8px 0; color: #2d3748;">${projectName}</td>
              </tr>
              ${priority ? `
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #4a5568;">Priority:</td>
                <td style="padding: 8px 0; color: #2d3748;">${priority}</td>
              </tr>
              ` : ''}
              ${status ? `
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #4a5568;">Status:</td>
                <td style="padding: 8px 0; color: #2d3748;">${status}</td>
              </tr>
              ` : ''}
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #4a5568;">Created By:</td>
                <td style="padding: 8px 0; color: #2d3748;">${createdBy}</td>
              </tr>
            </table>
            
            ${description ? `
            <div style="margin-top: 15px;">
              <p style="font-weight: bold; color: #4a5568; margin-bottom: 8px;">Description:</p>
              <div style="background-color: white; padding: 15px; border-radius: 6px; color: #2d3748; line-height: 1.6;">
                ${description}
              </div>
            </div>
            ` : ''}
          </div>

          <div style="background-color: #ebf8ff; border-left: 4px solid #4299e1; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #2b6cb0;">
              <strong>💡 Next Steps:</strong> Please log into your dashboard to view more details and start working on this ticket.
            </p>
          </div>

          <p style="color: #666; margin-top: 30px;">
            Best regards,<br>
            <strong>SA Ticketing System</strong>
          </p>
        </div>
        
        <div style="background-color: #f7fafc; padding: 15px; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="margin: 0; font-size: 12px; color: #718096;">
            This is an automated notification from SA Ticketing System
          </p>
        </div>
      </div>
    `;

    const textContent = `
Hi ${assigneeName},

You have been assigned a new ticket by ${createdBy}.

Ticket Details:
- Ticket ID: #${ticketId}
- Title: ${title}
- Project: ${projectName}
${priority ? `- Priority: ${priority}` : ''}
${status ? `- Status: ${status}` : ''}
- Created By: ${createdBy}

${description ? `Description: ${description}` : ''}

Please log into your dashboard to view more details and start working on this ticket.

Best regards,
SA Ticketing System
    `;

    return this.sendEmailWithPreferenceCheck({
      to,
      subject: `🎫 New Ticket Assigned: ${title} (#${ticketId})`,
      html,
      text: textContent
    });
  }

  // New email template for ticket updates
  async sendTicketUpdateEmail(
    to: string,
    ticketId: string,
    title: string,
    projectName: string,
    recipientName: string,
    updatedBy: string,
    changes: Array<{ field: string; oldValue?: string; newValue?: string }>
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const formatChanges = (changes: Array<{ field: string; oldValue?: string; newValue?: string }>) => {
      return changes.map(change => {
        const fieldName = change.field.charAt(0).toUpperCase() + change.field.slice(1).replace('_', ' ');
        if (change.oldValue && change.newValue) {
          return `<li><strong>${fieldName}:</strong> Changed from "${change.oldValue}" to "${change.newValue}"</li>`;
        } else if (change.newValue) {
          return `<li><strong>${fieldName}:</strong> Set to "${change.newValue}"</li>`;
        } else if (change.oldValue) {
          return `<li><strong>${fieldName}:</strong> Removed "${change.oldValue}"</li>`;
        }
        return `<li><strong>${fieldName}:</strong> Updated</li>`;
      }).join('');
    };

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">🔄 Ticket Updated</h1>
        </div>
        
        <div style="padding: 30px;">
          <p style="font-size: 16px; color: #333;">Hi <strong>${recipientName}</strong>,</p>
          <p style="color: #666; line-height: 1.6;">The ticket "<strong>${title}</strong>" has been updated by <strong>${updatedBy}</strong>.</p>
          
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0; color: #2d3748; border-bottom: 2px solid #ed64a6; padding-bottom: 8px;">📝 Ticket Information</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #4a5568; width: 120px;">Ticket ID:</td>
                <td style="padding: 8px 0; color: #2d3748;">#${ticketId}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #4a5568;">Title:</td>
                <td style="padding: 8px 0; color: #2d3748;">${title}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #4a5568;">Project:</td>
                <td style="padding: 8px 0; color: #2d3748;">${projectName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #4a5568;">Updated By:</td>
                <td style="padding: 8px 0; color: #2d3748;">${updatedBy}</td>
              </tr>
            </table>

            <h4 style="margin: 20px 0 10px 0; color: #2d3748;">🔍 Changes Made:</h4>
            <ul style="background-color: white; padding: 15px 15px 15px 35px; border-radius: 6px; margin: 0; color: #2d3748; line-height: 1.8;">
              ${formatChanges(changes)}
            </ul>
          </div>

          <div style="background-color: #f0fff4; border-left: 4px solid #38a169; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #276749;">
              <strong>💡 Action Required:</strong> Please review the updated ticket in your dashboard and take any necessary actions.
            </p>
          </div>

          <p style="color: #666; margin-top: 30px;">
            Best regards,<br>
            <strong>SA Ticketing System</strong>
          </p>
        </div>
        
        <div style="background-color: #f7fafc; padding: 15px; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="margin: 0; font-size: 12px; color: #718096;">
            This is an automated notification from SA Ticketing System
          </p>
        </div>
      </div>
    `;

    const textChanges = changes.map(change => {
      const fieldName = change.field.charAt(0).toUpperCase() + change.field.slice(1).replace('_', ' ');
      if (change.oldValue && change.newValue) {
        return `- ${fieldName}: Changed from "${change.oldValue}" to "${change.newValue}"`;
      } else if (change.newValue) {
        return `- ${fieldName}: Set to "${change.newValue}"`;
      } else if (change.oldValue) {
        return `- ${fieldName}: Removed "${change.oldValue}"`;
      }
      return `- ${fieldName}: Updated`;
    }).join('\n');

    const textContent = `
Hi ${recipientName},

The ticket "${title}" has been updated by ${updatedBy}.

Ticket Information:
- Ticket ID: #${ticketId}
- Title: ${title}
- Project: ${projectName}
- Updated By: ${updatedBy}

Changes Made:
${textChanges}

Please review the updated ticket in your dashboard and take any necessary actions.

Best regards,
SA Ticketing System
    `;

    return this.sendEmailWithPreferenceCheck({
      to,
      subject: `🔄 Ticket Updated: ${title} (#${ticketId})`,
      html,
      text: textContent
    });
  }

  // Send OTP for password change
  async sendPasswordChangeOTP(to: string, userName: string, otp: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2563eb; margin: 0;">🔐 Password Change Request</h1>
        </div>
        
        <div style="background-color: #f8fafc; padding: 24px; border-radius: 12px; border-left: 4px solid #2563eb;">
          <p style="margin: 0 0 16px 0; font-size: 16px;">Hi <strong>${userName}</strong>,</p>
          <p style="margin: 0 0 20px 0; color: #64748b;">You have requested to change your password. Please use the following OTP to verify your identity:</p>
          
          <div style="text-align: center; margin: 24px 0;">
            <div style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 16px 32px; border-radius: 8px; font-size: 32px; font-weight: bold; letter-spacing: 8px; font-family: 'Courier New', monospace;">
              ${otp}
            </div>
          </div>
          
          <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0; color: #92400e; font-size: 14px;">
              <strong>⚠️ Security Notice:</strong><br>
              • This OTP is valid for <strong>10 minutes</strong> only<br>
              • Do not share this code with anyone<br>
              • If you didn't request this change, please ignore this email
            </p>
          </div>
        </div>
        
        <div style="margin-top: 30px; padding: 20px; background-color: #f1f5f9; border-radius: 8px;">
          <p style="margin: 0; font-size: 14px; color: #64748b; text-align: center;">
            This is an automated message from Ticketing Metrix System.<br>
            If you have any concerns, please contact your system administrator.
          </p>
        </div>
      </div>
    `;

    const textContent = `
      Password Change Request
      
      Hi ${userName},
      
      You have requested to change your password. Please use the following OTP to verify your identity:
      
      OTP: ${otp}
      
      Security Notice:
      - This OTP is valid for 10 minutes only
      - Do not share this code with anyone  
      - If you didn't request this change, please ignore this email
      
      This is an automated message from Ticketing Metrix System.
    `;

    return this.sendEmail({
      to,
      subject: `🔐 Password Change OTP - ${otp}`,
      html,
      text: textContent
    });
  }

  async sendTicketCommentEmail(
    to: string,
    ticketId: string,
    ticketTitle: string,
    projectName: string,
    recipientName: string,
    commenterName: string,
    commentContent: string,
    isReply: boolean = false
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const ticketUrl = `${getBaseUrl()}/tickets/${ticketId}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .comment-box { background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; border-radius: 5px; }
            .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>💬 New Comment on Ticket</h1>
            </div>
            <div class="content">
              <p>Hi <strong>${recipientName}</strong>,</p>
              
              <p><strong>${commenterName}</strong> ${isReply ? 'replied to a comment' : 'added a comment'} on ticket:</p>
              
              <div class="comment-box">
                <h3>${ticketTitle}</h3>
                <p><strong>Project:</strong> ${projectName}</p>
                <p><strong>Comment:</strong></p>
                <p style="color: #555; font-style: italic;">"${commentContent}"</p>
              </div>

              <a href="${ticketUrl}" class="button">View Ticket</a>

              <p style="margin-top: 30px; color: #666; font-size: 14px;">
                Stay updated and respond to keep the conversation going!
              </p>

              <div class="footer">
                <p>This is an automated notification from Ticketing Metrix System</p>
                <p>© ${new Date().getFullYear()} All rights reserved</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const textContent = `
      New Comment on Ticket
      
      Hi ${recipientName},
      
      ${commenterName} ${isReply ? 'replied to a comment' : 'added a comment'} on ticket: ${ticketTitle}
      Project: ${projectName}
      
      Comment: "${commentContent}"
      
      View ticket: ${ticketUrl}
      
      This is an automated message from Ticketing Metrix System.
    `;

    return this.sendEmail({
      to,
      subject: `💬 New Comment on "${ticketTitle}" - ${projectName}`,
      html,
      text: textContent
    });
  }
}

// Export singleton instance
export const emailService = new EmailService();
export type { EmailOptions };