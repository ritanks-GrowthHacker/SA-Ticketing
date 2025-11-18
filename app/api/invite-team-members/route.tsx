import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/db/connections';
import { InvitationEmailService } from '../../../lib/invitationEmailService';

const invitationService = new InvitationEmailService();

interface TeamMember {
  email: string;
  department: string;
}

export async function POST(request: NextRequest) {
  try {
    const { orgId, teamMembers } = await request.json();

    // Validate required fields
    if (!orgId || !teamMembers || !Array.isArray(teamMembers)) {
      return NextResponse.json(
        { error: 'Organization ID and team members are required' },
        { status: 400 }
      );
    }

    // Validate team members data
    const validMembers = teamMembers.filter(
      (member: TeamMember) => member.email && member.department
    );

    if (validMembers.length === 0) {
      return NextResponse.json(
        { error: 'At least one valid team member is required' },
        { status: 400 }
      );
    }

    if (!supabase) {
      return NextResponse.json(
        { error: 'Database configuration error' },
        { status: 500 }
      );
    }

    // Get organization details
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('name, domain, associated_departments')
      .eq('id', orgId)
      .single();

    if (orgError || !organization) {
      console.error('Error fetching organization:', orgError);
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Validate email domains if organization has a domain set
    if (organization.domain) {
      const orgDomain = organization.domain.toLowerCase();
      const invalidEmails = validMembers.filter((member: TeamMember) => {
        const emailDomain = member.email.split('@')[1]?.toLowerCase();
        return emailDomain !== orgDomain;
      });

      if (invalidEmails.length > 0) {
        return NextResponse.json(
          {
            error: `Email domain mismatch. All invitations must use the organization's domain: @${orgDomain}`,
            invalidEmails: invalidEmails.map(m => m.email),
            expectedDomain: orgDomain
          },
          { status: 400 }
        );
      }
    }

    // Get department details for validation and email content
    const departmentIds = validMembers.map(m => m.department);
    const { data: departments, error: deptError } = await supabase
      .from('departments')
      .select('id, name')
      .in('id', departmentIds)
      .eq('is_active', true);

    if (deptError || !departments) {
      console.error('Error fetching departments:', deptError);
      return NextResponse.json(
        { error: 'Failed to validate departments' },
        { status: 500 }
      );
    }

    // Create department lookup map
    const departmentMap = departments.reduce((map: Record<string, string>, dept: any) => {
      map[dept.id] = dept.name;
      return map;
    }, {} as Record<string, string>);

    // Check for existing users
    const emails = validMembers.map(m => m.email.toLowerCase());
    const { data: existingUsers } = await supabase
      .from('users')
      .select('email')
      .in('email', emails);

    const existingEmails = new Set(existingUsers?.map((u: any) => u.email.toLowerCase()) || []);

    // Check for existing invitations
    const { data: existingInvitations } = await supabase
      .from('invitations')
      .select('email')
      .eq('organization_id', orgId)
      .in('email', emails)
      .eq('status', 'pending');

    const existingInvitationEmails = new Set(existingInvitations?.map((i: any) => i.email.toLowerCase()) || []);
    
    // Send invitations
    const results = [];
    
    for (const member of validMembers) {
      try {
        // If user already exists, try to add them to the requested department
        if (existingEmails.has(member.email.toLowerCase())) {
          try {
            // Fetch existing user details
            const { data: existingUserData, error: existingUserError } = await supabase
              .from('users')
              .select('id, organization_id')
              .eq('email', member.email.toLowerCase())
              .maybeSingle();

            if (existingUserError || !existingUserData) {
              results.push({
                email: member.email,
                success: false,
                message: 'Failed to fetch existing user'
              });
              continue;
            }

            // Ensure user belongs to the same organization
            if (existingUserData.organization_id && existingUserData.organization_id !== orgId) {
              results.push({
                email: member.email,
                success: false,
                message: 'User belongs to a different organization'
              });
              continue;
            }

            // Check if user already has a department role for this department
            const { data: existingDeptRole } = await supabase
              .from('user_department_roles')
              .select('id')
              .eq('user_id', existingUserData.id)
              .eq('department_id', member.department)
              .eq('organization_id', orgId)
              .maybeSingle();

            if (existingDeptRole) {
              results.push({
                email: member.email,
                success: false,
                message: 'User is already a member of the selected department'
              });
              continue;
            }

            // Determine role id to assign (default to 'Member' if not provided)
            const roleNameToAssign = member.role || 'Member';
            const { data: roleData } = await supabase
              .from('global_roles')
              .select('id')
              .eq('name', roleNameToAssign)
              .maybeSingle();

            const roleIdToUse = roleData?.id || null;

            // Insert department role for the existing user
            const { error: insertDeptError } = await supabase
              .from('user_department_roles')
              .insert({
                user_id: existingUserData.id,
                role_id: roleIdToUse,
                department_id: member.department,
                organization_id: orgId
              });

            if (insertDeptError) {
              console.error('Error adding existing user to department:', insertDeptError);
              results.push({
                email: member.email,
                success: false,
                message: 'Failed to add existing user to department'
              });
              continue;
            }

            results.push({
              email: member.email,
              success: true,
              message: 'Existing user added to department successfully'
            });
            continue;
          } catch (err) {
            console.error('Error processing existing user invite:', err);
            results.push({
              email: member.email,
              success: false,
              message: 'Failed to process existing user'
            });
            continue;
          }
        }

        // Skip if already invited
        if (existingInvitationEmails.has(member.email.toLowerCase())) {
          results.push({
            email: member.email,
            success: false,
            message: 'User already invited and pending registration'
          });
          continue;
        }

        // Get department name
        const departmentName = departmentMap[member.department];
        if (!departmentName) {
          results.push({
            email: member.email,
            success: false,
            message: 'Invalid department selected'
          });
          continue;
        }

        // Save invitation to database first
        const { data: invitation, error: inviteError } = await supabase
          .from('invitations')
          .insert({
            organization_id: orgId,
            department_id: member.department,
            email: member.email.toLowerCase(),
            name: member.name,
            job_title: member.role,
            phone: member.phone || null
          })
          .select()
          .single();

        if (inviteError) {
          console.error('Error saving invitation:', inviteError);
          results.push({
            email: member.email,
            success: false,
            message: 'Failed to save invitation to database'
          });
          continue;
        }

        // Send invitation email with invitation token
        const emailResult = await invitationService.sendUserInvitation({
          email: member.email,
          name: member.name,
          organizationName: organization.name,
          departmentName: departmentName,
          orgId: orgId,
          departmentId: member.department,
          jobTitle: member.role,
          invitationToken: invitation.invitation_token
        });

        if (emailResult.success) {
          results.push({
            email: member.email,
            success: true,
            message: 'Invitation sent successfully'
          });
        } else {
          // If email fails, remove the invitation from database
          await supabase
            .from('invitations')
            .delete()
            .eq('id', invitation.id);
          
          results.push({
            email: member.email,
            success: false,
            message: emailResult.message || 'Failed to send invitation email'
          });
        }

      } catch (error) {
        console.error(`Error sending invitation to ${member.email}:`, error);
        results.push({
          email: member.email,
          success: false,
          message: 'Failed to send invitation email'
        });
      }
    }

    // Check results
    const successfulInvitations = results.filter(r => r.success).length;
    const failedInvitations = results.filter(r => !r.success);

    if (successfulInvitations === 0) {
      return NextResponse.json({
        success: false,
        error: 'Failed to send any invitations',
        results
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully sent ${successfulInvitations} invitation${successfulInvitations > 1 ? 's' : ''}`,
      results,
      summary: {
        total: validMembers.length,
        successful: successfulInvitations,
        failed: failedInvitations.length
      }
    });

  } catch (error) {
    console.error('Error in invite-team-members:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}