import { emailService } from './emailService';

interface InvitationData {
  email: string;
  name?: string;
  organizationName: string;
  departments?: { id: string; name: string }[];
  departmentName?: string;
  orgId?: string;
  departmentId?: string;
  jobTitle?: string;
  invitationToken?: string;
}

export class InvitationEmailService {
  constructor() {
    // Using the singleton emailService instance
  }

  async sendUserInvitation(data: InvitationData): Promise<{ success: boolean; message: string }> {
    try {
      // Create registration link
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const userName = data.name || data.email.split('@')[0];
      const params = new URLSearchParams({
        email: data.email,
        name: userName
      });
      
      // Add department info if provided
      if (data.orgId) params.append('orgId', data.orgId);
      if (data.departmentId) params.append('departmentId', data.departmentId);
      if (data.invitationToken) params.append('token', data.invitationToken);
      
      const registrationLink = `${baseUrl}/register-user?${params.toString()}`;
      
      // Create department list for email
      const departmentList = data.departments 
        ? data.departments.map(d => d.name).join(', ')
        : data.departmentName || 'Not specified';
      
      // Email content
      const emailSubject = `🎉 Invitation to join ${data.organizationName}`;
      const emailHtml = this.generateInvitationHTML(data, registrationLink, departmentList);
      
      const result = await emailService.sendEmail({
        to: data.email,
        subject: emailSubject,
        html: emailHtml
      });

      if (result.success) {
        return {
          success: true,
          message: 'Invitation email sent successfully'
        };
      } else {
        console.error('Email sending failed:', result.error);
        return {
          success: false,
          message: result.error || 'Failed to send invitation email'
        };
      }

    } catch (error) {
      console.error('Error sending invitation email:', error);
      return {
        success: false,
        message: 'Failed to send invitation email'
      };
    }
  }

  private generateInvitationHTML(data: InvitationData, registrationLink: string, departmentList: string): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to ${data.organizationName}</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; color: white;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700;">🎉 Welcome to ${data.organizationName}!</h1>
              <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">You've been invited to join our team</p>
            </div>
          </div>

          <!-- Main Content -->
          <div style="background-color: white; padding: 40px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
            
            <!-- Greeting -->
            <div style="margin-bottom: 30px;">
              <h2 style="color: #1a202c; margin-bottom: 15px; font-size: 20px;">Hi ${data.name || data.email.split('@')[0]}! 👋</h2>
              <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0;">
                You've been invited to join <strong style="color: #667eea;">${data.organizationName}</strong> 
                ${data.jobTitle ? `as a <strong style="color: #667eea;">${data.jobTitle}</strong>` : 'as a team member'}.
                We're excited to have you on board!
              </p>
            </div>

            <!-- Department Assignment -->
            <div style="background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%); padding: 25px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #667eea;">
              <h3 style="color: #2d3748; margin: 0 0 15px 0; font-size: 18px; display: flex; align-items: center;">
                📋 Your Department Assignment
              </h3>
              <div style="background-color: white; padding: 15px; border-radius: 6px; border: 1px solid #e2e8f0;">
                <p style="color: #4a5568; margin: 0; font-size: 16px; font-weight: 600;">${departmentList}</p>
              </div>
            </div>

            <!-- Call to Action -->
            <div style="text-align: center; margin: 40px 0;">
              <a href="${registrationLink}" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                        color: white; 
                        padding: 16px 32px; 
                        text-decoration: none; 
                        border-radius: 8px; 
                        font-weight: 600; 
                        font-size: 16px;
                        display: inline-block; 
                        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
                        transition: all 0.3s ease;">
                🚀 Complete Your Registration
              </a>
            </div>

            <!-- Next Steps -->
            <div style="background-color: #f7fafc; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
              <h4 style="color: #2d3748; margin: 0 0 15px 0; font-size: 16px; font-weight: 600;">What happens next?</h4>
              <div style="color: #4a5568; line-height: 1.8;">
                <div style="margin-bottom: 8px; display: flex; align-items: center;">
                  <span style="color: #667eea; margin-right: 10px; font-weight: bold;">1.</span>
                  Click the registration button above
                </div>
                <div style="margin-bottom: 8px; display: flex; align-items: center;">
                  <span style="color: #667eea; margin-right: 10px; font-weight: bold;">2.</span>
                  Create your account and set up your profile
                </div>
                <div style="margin-bottom: 8px; display: flex; align-items: center;">
                  <span style="color: #667eea; margin-right: 10px; font-weight: bold;">3.</span>
                  Start collaborating with your team members
                </div>
                <div style="display: flex; align-items: center;">
                  <span style="color: #667eea; margin-right: 10px; font-weight: bold;">4.</span>
                  Access projects and tools in your assigned departments
                </div>
              </div>
            </div>

            <!-- Important Notice -->
            <div style="background-color: #fff5f5; border: 1px solid #fed7d7; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
              <div style="display: flex; align-items: flex-start;">
                <span style="color: #e53e3e; font-size: 20px; margin-right: 12px;">⚠️</span>
                <div>
                  <h4 style="color: #742a2a; margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">Important</h4>
                  <p style="color: #742a2a; margin: 0; font-size: 14px; line-height: 1.5;">
                    This invitation link will expire in <strong>7 days</strong>. 
                    If you encounter any issues or have questions, please contact your organization administrator.
                  </p>
                </div>
              </div>
            </div>

            <!-- Contact Info -->
            <div style="text-align: center; padding-top: 25px; border-top: 1px solid #e2e8f0;">
              <p style="color: #718096; font-size: 14px; margin: 0; line-height: 1.6;">
                Need help? Contact your organization administrator or reply to this email.
              </p>
            </div>

          </div>

          <!-- Footer -->
          <div style="text-align: center; margin-top: 30px; padding: 20px;">
            <p style="color: #a0aec0; font-size: 12px; margin: 0;">
              This invitation was sent by ${data.organizationName}. 
              <br>If you received this email by mistake, please ignore it.
            </p>
          </div>

        </div>
      </body>
      </html>
    `;
  }

  async sendExistingUserDepartmentNotification(data: { 
    email: string; 
    name: string; 
    organizationName: string; 
    departmentName: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const emailSubject = `🎉 You've been added to ${data.departmentName}!`;
      const emailHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Department Access</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; color: white;">
                <h1 style="margin: 0; font-size: 28px; font-weight: 700;">🎉 New Department Access!</h1>
                <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">You've been added to ${data.departmentName}</p>
              </div>
            </div>

            <div style="background-color: white; padding: 40px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
              
              <div style="margin-bottom: 30px;">
                <h2 style="color: #1a202c; margin-bottom: 15px; font-size: 20px;">Hi ${data.name}! 👋</h2>
                <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                  Great news! You have been added to a new department in <strong>${data.organizationName}</strong>.
                </p>
                <div style="background-color: #f7fafc; border-left: 4px solid #667eea; padding: 20px; border-radius: 4px; margin: 20px 0;">
                  <p style="color: #2d3748; margin: 0; font-size: 16px;">
                    <strong>Department:</strong> ${data.departmentName}
                  </p>
                </div>
                <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 20px 0 0 0;">
                  You can now access projects and resources for this department. Simply login with your existing credentials to get started!
                </p>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/user-login" 
                   style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);">
                  Login Now
                </a>
              </div>

              <div style="background-color: #ebf8ff; border: 1px solid #bee3f8; border-radius: 8px; padding: 20px; margin-top: 30px;">
                <p style="color: #2c5282; margin: 0; font-size: 14px; line-height: 1.6;">
                  <strong>💡 Tip:</strong> Use the department switcher in the navbar to switch between your departments after logging in.
                </p>
              </div>

              <div style="text-align: center; padding-top: 25px; border-top: 1px solid #e2e8f0; margin-top: 30px;">
                <p style="color: #718096; font-size: 14px; margin: 0; line-height: 1.6;">
                  Need help? Contact your organization administrator or reply to this email.
                </p>
              </div>

            </div>

            <div style="text-align: center; margin-top: 30px; padding: 20px;">
              <p style="color: #a0aec0; font-size: 12px; margin: 0;">
                This notification was sent by ${data.organizationName}. 
              </p>
            </div>

          </div>
        </body>
        </html>
      `;

      const result = await emailService.sendEmail({
        to: data.email,
        subject: emailSubject,
        html: emailHtml
      });

      if (result.success) {
        return {
          success: true,
          message: 'Department notification email sent successfully'
        };
      } else {
        console.error('Email sending failed:', result.error);
        return {
          success: false,
          message: result.error || 'Failed to send notification email'
        };
      }

    } catch (error) {
      console.error('Error sending department notification email:', error);
      return {
        success: false,
        message: 'Failed to send notification email'
      };
    }
  }
}