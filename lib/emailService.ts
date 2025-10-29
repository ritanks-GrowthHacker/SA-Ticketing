import nodemailer from "nodemailer";

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
      user: process.env.EMAIL_USER || "rihina.techorzo@gmail.com",
      pass: process.env.EMAIL_PASS || "wdufgyawvizccnwc",
    };

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

    return this.sendEmail({
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

    return this.sendEmail({
      to,
      subject: `Ticket ${status} - ${ticketId}`,
      html,
      text: `Hi ${assigneeName}, Ticket ${ticketId} (${title}) is now ${status}.`
    });
  }
}

// Export singleton instance
export const emailService = new EmailService();
export type { EmailOptions };