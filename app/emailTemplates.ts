/**
 * Global Email Templates
 * All email HTML templates used across the application (Tickets, Sales, etc.)
 */

// Helper to get base URL
const getBaseUrl = () => process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

interface QuoteEmailData {
  quoteNumber: string;
  quoteTitle: string;
  totalAmount: number;
  currency: string;
  validUntil?: string;
  clientName: string;
  contactPerson?: string;
  magicLink: string;
}

interface QuoteAcceptedEmailData {
  invoiceNumber: string;
  quoteNumber: string;
  totalAmount: number;
  currency: string;
  clientName: string;
  contactPerson?: string;
  bankDetails?: {
    bankName: string;
    accountNumber: string;
    ifscCode: string;
    accountName: string;
    upiId: string;
  };
}

interface ClientConnectEmailData {
  salesPersonName: string;
  quoteNumber: string;
  quoteTitle: string;
  totalAmount: number;
  currency: string;
  clientName: string;
  contactPerson?: string;
  clientEmail: string;
  clientPhone?: string;
}

interface TicketAssignmentEmailData {
  assigneeName: string;
  ticketId: string;
  title: string;
  description?: string;
  projectName: string;
  createdBy: string;
  priority?: string;
  status?: string;
}

interface TicketUpdateEmailData {
  recipientName: string;
  ticketId: string;
  title: string;
  projectName: string;
  updatedBy: string;
  changes: Array<{
    field: string;
    oldValue?: string;
    newValue?: string;
  }>;
}

interface TeamAssignmentEmailData {
  assigneeName: string;
  projectName: string;
  role: string;
}

interface PasswordOTPEmailData {
  userName: string;
  otp: string;
}

export const emailTemplates = {
  // ==================== SALES MODULE ====================

  /**
   * Email sent to client when quote is sent
   */
  quoteSent: (data: QuoteEmailData): string => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">New Quote from Your Sales Team</h2>
      <p>Hello ${data.contactPerson || data.clientName},</p>
      <p>We have prepared a quote for you:</p>
      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>Quote Number:</strong> ${data.quoteNumber}</p>
        <p style="margin: 5px 0;"><strong>Title:</strong> ${data.quoteTitle}</p>
        <p style="margin: 5px 0;"><strong>Amount:</strong> ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: data.currency || 'INR' }).format(data.totalAmount)}</p>
        <p style="margin: 5px 0;"><strong>Valid Until:</strong> ${data.validUntil ? new Date(data.validUntil).toLocaleDateString() : 'N/A'}</p>
      </div>
      <p>Click the button below to view and review your quote:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${data.magicLink}" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          View Quote
        </a>
      </div>
      <p style="color: #666; font-size: 12px;">This link will expire in 15 days.</p>
      <p style="color: #666; font-size: 12px;">If you have any questions, please don't hesitate to contact us.</p>
    </div>
  `,

  /**
   * Email sent to client when they accept the quote
   */
  quoteAccepted: (data: QuoteAcceptedEmailData): string => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #16a34a;">✅ Quote Accepted - Invoice Generated</h2>
      <p>Hello ${data.contactPerson || data.clientName},</p>
      <p>Thank you for accepting our quote! Your invoice has been generated:</p>
      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>Invoice Number:</strong> ${data.invoiceNumber}</p>
        <p style="margin: 5px 0;"><strong>Quote Number:</strong> ${data.quoteNumber}</p>
        <p style="margin: 5px 0;"><strong>Amount Due:</strong> ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: data.currency || 'INR' }).format(data.totalAmount)}</p>
      </div>
      <h3 style="color: #333;">Payment Details:</h3>
      <div style="background: #e8f5e9; padding: 15px; border-radius: 6px; margin: 15px 0;">
        <p style="margin: 5px 0;"><strong>Bank Name:</strong> ${data.bankDetails?.bankName || 'Your Bank Name'}</p>
        <p style="margin: 5px 0;"><strong>Account Number:</strong> ${data.bankDetails?.accountNumber || 'XXXX XXXX XXXX'}</p>
        <p style="margin: 5px 0;"><strong>IFSC Code:</strong> ${data.bankDetails?.ifscCode || 'YOURBANK0000'}</p>
        <p style="margin: 5px 0;"><strong>Account Name:</strong> ${data.bankDetails?.accountName || 'Your Company Name'}</p>
        <p style="margin: 5px 0;"><strong>UPI ID:</strong> ${data.bankDetails?.upiId || 'yourcompany@upi'}</p>
      </div>
      <p>Please make the payment and send us the payment reference/screenshot for confirmation.</p>
      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        For any questions, please contact us at sales@yourcompany.com
      </p>
    </div>
  `,

  /**
   * Email sent to sales person when client clicks "Let's Connect"
   */
  clientConnectRequest: (data: ClientConnectEmailData): string => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #3b82f6;">Client Wants to Connect!</h2>
      <p>Hello ${data.salesPersonName},</p>
      <p>Good news! A client has expressed interest in your quote and wants to discuss it further.</p>
      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>Quote Number:</strong> ${data.quoteNumber}</p>
        <p style="margin: 5px 0;"><strong>Quote Title:</strong> ${data.quoteTitle}</p>
        <p style="margin: 5px 0;"><strong>Amount:</strong> ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: data.currency || 'INR' }).format(data.totalAmount)}</p>
      </div>
      <div style="background: #e0f2fe; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #0369a1;">Client Details:</h3>
        <p style="margin: 5px 0;"><strong>Name:</strong> ${data.clientName}</p>
        <p style="margin: 5px 0;"><strong>Contact Person:</strong> ${data.contactPerson || 'N/A'}</p>
        <p style="margin: 5px 0;"><strong>Email:</strong> ${data.clientEmail}</p>
        <p style="margin: 5px 0;"><strong>Phone:</strong> ${data.clientPhone || 'N/A'}</p>
      </div>
      <p><strong>Action Required:</strong> Please reach out to the client to discuss their requirements.</p>
      <p>The quote status has been updated to <strong>Hold</strong>.</p>
      <p style="color: #666; font-size: 12px; margin-top: 30px;">This is an automated notification from your Sales System.</p>
    </div>
  `,

  // ==================== TICKETING MODULE ====================

  /**
   * Email sent when a ticket is assigned to a user
   */
  ticketAssignment: (data: TicketAssignmentEmailData): string => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">🎫 New Ticket Assigned</h1>
      </div>
      
      <div style="padding: 30px;">
        <p style="font-size: 16px; color: #333;">Hi <strong>${data.assigneeName}</strong>,</p>
        <p style="color: #666; line-height: 1.6;">You have been assigned a new ticket by <strong>${data.createdBy}</strong>. Please review the details below:</p>
        
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h3 style="margin: 0 0 15px 0; color: #2d3748; border-bottom: 2px solid #4299e1; padding-bottom: 8px;">📋 Ticket Details</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #4a5568; width: 120px;">Ticket ID:</td>
              <td style="padding: 8px 0; color: #2d3748;">#${data.ticketId}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #4a5568;">Title:</td>
              <td style="padding: 8px 0; color: #2d3748;">${data.title}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #4a5568;">Project:</td>
              <td style="padding: 8px 0; color: #2d3748;">${data.projectName}</td>
            </tr>
            ${data.priority ? `
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #4a5568;">Priority:</td>
              <td style="padding: 8px 0; color: #2d3748;">${data.priority}</td>
            </tr>
            ` : ''}
            ${data.status ? `
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #4a5568;">Status:</td>
              <td style="padding: 8px 0; color: #2d3748;">${data.status}</td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #4a5568;">Created By:</td>
              <td style="padding: 8px 0; color: #2d3748;">${data.createdBy}</td>
            </tr>
          </table>
          
          ${data.description ? `
          <div style="margin-top: 15px;">
            <p style="font-weight: bold; color: #4a5568; margin-bottom: 8px;">Description:</p>
            <div style="background-color: white; padding: 15px; border-radius: 6px; color: #2d3748; line-height: 1.6;">
              ${data.description}
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
  `,

  /**
   * Email sent when a ticket is updated
   */
  ticketUpdate: (data: TicketUpdateEmailData): string => {
    const htmlChanges = data.changes.map(change => {
      const fieldName = change.field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      if (change.oldValue && change.newValue) {
        return `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #4a5568;">${fieldName}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #e53e3e; text-decoration: line-through;">${change.oldValue}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #38a169; font-weight: bold;">${change.newValue}</td>
          </tr>
        `;
      } else if (change.newValue) {
        return `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #4a5568;">${fieldName}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #718096;">-</td>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #38a169; font-weight: bold;">${change.newValue}</td>
          </tr>
        `;
      }
      return '';
    }).join('');

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">🔄 Ticket Updated</h1>
        </div>
        
        <div style="padding: 30px;">
          <p style="font-size: 16px; color: #333;">Hi <strong>${data.recipientName}</strong>,</p>
          <p style="color: #666; line-height: 1.6;">The ticket "<strong>${data.title}</strong>" has been updated by <strong>${data.updatedBy}</strong>.</p>
          
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #2d3748;">📋 Ticket Information</h3>
            <p style="margin: 5px 0; color: #4a5568;"><strong>Ticket ID:</strong> #${data.ticketId}</p>
            <p style="margin: 5px 0; color: #4a5568;"><strong>Title:</strong> ${data.title}</p>
            <p style="margin: 5px 0; color: #4a5568;"><strong>Project:</strong> ${data.projectName}</p>
            <p style="margin: 5px 0; color: #4a5568;"><strong>Updated By:</strong> ${data.updatedBy}</p>
          </div>

          <div style="margin: 20px 0;">
            <h3 style="color: #2d3748; margin-bottom: 10px;">📝 Changes Made:</h3>
            <table style="width: 100%; border-collapse: collapse; background-color: white; border: 1px solid #e2e8f0; border-radius: 8px;">
              <thead>
                <tr style="background-color: #f7fafc;">
                  <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #2d3748;">Field</th>
                  <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #2d3748;">Old Value</th>
                  <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #2d3748;">New Value</th>
                </tr>
              </thead>
              <tbody>
                ${htmlChanges}
              </tbody>
            </table>
          </div>

          <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #92400e;">
              <strong>📌 Action Required:</strong> Please review the updated ticket and take any necessary actions.
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
  },

  /**
   * Email sent when user is assigned to a project team
   */
  teamAssignment: (data: TeamAssignmentEmailData): string => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Team Assignment Notification</h2>
      <p>Hi <strong>${data.assigneeName}</strong>,</p>
      <p>You have been assigned to the <strong>${data.projectName}</strong> project as a <strong>${data.role}</strong>.</p>
      <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <h3 style="margin: 0 0 8px 0;">Assignment Details:</h3>
        <ul style="margin: 0; padding-left: 20px;">
          <li>Project: ${data.projectName}</li>
          <li>Role: ${data.role}</li>
          <li>Status: Active</li>
        </ul>
      </div>
      <p>Please check your dashboard for more details about the project.</p>
      <p>Best regards,<br>Ticketing Metrix Team</p>
    </div>
  `,

  /**
   * Email sent for password change OTP
   */
  passwordOTP: (data: PasswordOTPEmailData): string => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #2563eb; margin: 0;">🔐 Password Change Request</h1>
      </div>
      
      <div style="background-color: #f8fafc; padding: 24px; border-radius: 12px; border-left: 4px solid #2563eb;">
        <p style="margin: 0 0 16px 0; font-size: 16px;">Hi <strong>${data.userName}</strong>,</p>
        <p style="margin: 0 0 20px 0; color: #64748b;">You have requested to change your password. Please use the following OTP to verify your identity:</p>
        
        <div style="text-align: center; margin: 24px 0;">
          <div style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 16px 32px; border-radius: 8px; font-size: 32px; font-weight: bold; letter-spacing: 8px; font-family: 'Courier New', monospace;">
            ${data.otp}
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
  `,
};

// Export types for TypeScript support
export type {
  QuoteEmailData,
  QuoteAcceptedEmailData,
  ClientConnectEmailData,
  TicketAssignmentEmailData,
  TicketUpdateEmailData,
  TeamAssignmentEmailData,
  PasswordOTPEmailData,
};
