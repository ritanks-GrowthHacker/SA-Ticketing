import { NextRequest, NextResponse } from 'next/server';
// import { supabase } from '@/app/db/connections';
import { db, organizations, users, departments, eq, inArray } from '@/lib/db-helper';
import { InvitationEmailService } from '@/lib/invitationEmailService';

interface UserInvite {
  name: string;
  email: string;
  selectedDepartments: string[];
  jobTitle?: string;
}

interface OrgSetupRequest {
  orgId?: string;
  selectedDepartments: string[];
  userInvites: UserInvite[];
}

export async function POST(request: NextRequest) {
  try {
    const body: OrgSetupRequest = await request.json();
    const { orgId, selectedDepartments, userInvites } = body;

    // Validate required fields
    if (!orgId || !selectedDepartments || selectedDepartments.length === 0) {
      return NextResponse.json(
        { error: 'Organization ID and departments are required' },
        { status: 400 }
      );
    }

    // Verify organization exists and is verified
    const orgResults = await db.select({
      id: organizations.id,
      name: organizations.name,
      orgEmail: organizations.orgEmail,
      otpVerified: organizations.otpVerified,
      domain: organizations.domain
    })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);
    
    const organization = orgResults[0] || null;

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    if (!organization.otpVerified) {
      return NextResponse.json(
        { error: 'Organization email must be verified first' },
        { status: 400 }
      );
    }

    // Validate email domains if organization has a domain set
    if (organization.domain && userInvites.length > 0) {
      const orgDomain = organization.domain.toLowerCase();
      const invalidEmails = userInvites.filter((invite: UserInvite) => {
        const emailDomain = invite.email.split('@')[1]?.toLowerCase();
        return emailDomain !== orgDomain;
      });

      if (invalidEmails.length > 0) {
        return NextResponse.json(
          {
            error: `Email domain mismatch. All invitations must use the organization's domain: @${orgDomain}`,
            invalidEmails: invalidEmails.map(inv => inv.email),
            expectedDomain: orgDomain
          },
          { status: 400 }
        );
      }
    }

    // Update organization with selected departments
    try {
      await db.update(organizations)
        .set({
          associatedDepartments: selectedDepartments
        })
        .where(eq(organizations.id, orgId));
    } catch (updateError) {
      console.error('Error updating organization departments:', updateError);
      return NextResponse.json(
        { error: 'Failed to update organization departments' },
        { status: 500 }
      );
    }

    // Process user invitations
    const inviteResults = [];
    
    for (const invite of userInvites) {
      if (!invite.name || !invite.email) {
        continue; // Skip incomplete invites
      }

      try {
        // Check if user already exists
        const existingUserResults = await db.select({
          id: users.id,
          email: users.email
        })
          .from(users)
          .where(eq(users.email, invite.email))
          .limit(1);
        
        const existingUser = existingUserResults[0] || null;

        if (existingUser) {
          // User exists, update their departments (add to existing)
          const userDataResults = await db.select({
            department: users.department,
            organizationId: users.organizationId,
            jobTitle: users.jobTitle
          })
            .from(users)
            .where(eq(users.id, existingUser.id))
            .limit(1);
          
          const userData = userDataResults[0];

          if (userData) {
            // Note: Using single department field instead of array
            // If you need to support multiple departments, update schema
            const primaryDepartment = invite.selectedDepartments[0] || userData.department;
            
            await db.update(users)
              .set({
                department: primaryDepartment,
                organizationId: orgId, // Update organization if different
                jobTitle: invite.jobTitle || userData.jobTitle
              })
              .where(eq(users.id, existingUser.id));

            inviteResults.push({
              email: invite.email,
              status: 'updated',
              message: 'Existing user updated with new departments'
            });
          }
        } else {
          // Send invitation email to new user
          const inviteToken = generateInviteToken(invite.email, orgId);
          const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/register-user?token=${inviteToken}&org=${orgId}`;
          
          const emailBody = generateInviteEmailBody({
            userName: invite.name,
            organizationName: organization.name,
            inviteLink,
            jobTitle: invite.jobTitle,
            departments: invite.selectedDepartments
          });

          // Get department names for the invitation
          const deptData = await db.select({
            id: departments.id,
            name: departments.name
          })
            .from(departments)
            .where(inArray(departments.id, invite.selectedDepartments));
          
          const invitationService = new InvitationEmailService();
          const emailResult = await invitationService.sendUserInvitation({
            email: invite.email,
            name: invite.name,
            organizationName: organization.name,
            departments: deptData || [],
            jobTitle: invite.jobTitle
          });
          
          if (emailResult.success) {
            // Store pending invitation in a temporary way (you might want a proper invitations table)
            inviteResults.push({
              email: invite.email,
              status: 'invited',
              message: 'Invitation email sent successfully'
            });
          } else {
            inviteResults.push({
              email: invite.email,
              status: 'failed',
              message: emailResult.message || 'Failed to send invitation email'
            });
          }
        }
      } catch (error) {
        console.error(`Error processing invite for ${invite.email}:`, error);
        inviteResults.push({
          email: invite.email,
          status: 'error',
          message: 'Error processing invitation'
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Organization setup completed successfully',
      inviteResults,
      departmentsUpdated: selectedDepartments.length,
      invitesSent: inviteResults.filter(r => r.status === 'invited').length
    });

  } catch (error) {
    console.error('Error in org-setup:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to generate invite token
function generateInviteToken(email: string, orgId: string): string {
  const data = JSON.stringify({ email, orgId, timestamp: Date.now() });
  return Buffer.from(data).toString('base64url');
}

// Helper function to generate email body
function generateInviteEmailBody(data: {
  userName: string;
  organizationName: string;
  inviteLink: string;
  jobTitle?: string;
  departments: string[];
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>You're Invited to Join ${data.organizationName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
    <div style="max-width: 600px; margin: 0 auto; background-color: white; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 300;">
                🎉 You're Invited!
            </h1>
        </div>
        
        <!-- Content -->
        <div style="padding: 40px 30px;">
            <h2 style="color: #2d3748; margin-bottom: 20px; font-size: 24px;">
                Hello ${data.userName}!
            </h2>
            
            <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
                Great news! You've been invited to join <strong>${data.organizationName}</strong> on our platform.
                ${data.jobTitle ? `You'll be joining as a <strong>${data.jobTitle}</strong>.` : ''}
            </p>

            ${data.departments.length > 0 ? `
            <div style="background-color: #edf2f7; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
                <h3 style="color: #2d3748; margin: 0 0 10px 0; font-size: 16px;">Your Departments:</h3>
                <div style="color: #4a5568;">
                    ${data.departments.map(dept => `<span style="display: inline-block; background-color: #4299e1; color: white; padding: 4px 12px; border-radius: 20px; font-size: 14px; margin: 2px 4px 2px 0;">${dept}</span>`).join('')}
                </div>
            </div>
            ` : ''}
            
            <div style="text-align: center; margin: 35px 0;">
                <a href="${data.inviteLink}" 
                   style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                          color: white; text-decoration: none; padding: 15px 30px; 
                          border-radius: 8px; font-size: 16px; font-weight: 600; 
                          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
                          transition: transform 0.2s;">
                    ✨ Accept Invitation & Register
                </a>
            </div>
            
            <div style="background-color: #f7fafc; padding: 20px; border-radius: 8px; margin-top: 25px;">
                <h4 style="color: #2d3748; margin: 0 0 10px 0; font-size: 16px;">What's Next?</h4>
                <ul style="color: #4a5568; padding-left: 20px; margin: 0;">
                    <li>Click the button above to create your account</li>
                    <li>Set up your profile and password</li>
                    <li>Start collaborating with your team</li>
                </ul>
            </div>
            
            <p style="color: #718096; font-size: 14px; margin-top: 30px; text-align: center;">
                This invitation link will expire in 7 days for security reasons.<br>
                If you have any questions, feel free to contact your team administrator.
            </p>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #edf2f7; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #718096; font-size: 14px; margin: 0;">
                Sent by ${data.organizationName} via SA-Ticketing Platform
            </p>
        </div>
    </div>
</body>
</html>`;
}

// Helper function to send invite email
async function sendInviteEmail(email: string, organizationName: string, htmlBody: string): Promise<boolean> {
  try {
    // You can use your existing email service or implement a new one
    // For now, using console.log to simulate email sending
    console.log(`📧 Sending invite email to: ${email}`);
    console.log(`📧 Organization: ${organizationName}`);
    console.log(`📧 Email body generated successfully`);
    
    // TODO: Implement actual email sending using your email service
    // Example: await emailService.send(email, subject, htmlBody);
    
    return true; // Simulate successful sending
  } catch (error) {
    console.error('Error sending invite email:', error);
    return false;
  }
}