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

    // Check for existing users WITH their department associations
    const emails = validMembers.map(m => m.email.toLowerCase());
    const { data: existingUsers } = await supabase
      .from('users')
      .select('id, email, name, department_id')
      .in('email', emails);

    // Create map of existing users: email -> user data
    const existingUserMap = new Map(
      existingUsers?.map((u: any) => [u.email.toLowerCase(), u]) || []
    );

    // Also check user_department_roles for all department associations
    const userIds = existingUsers?.map((u: any) => u.id) || [];
    const { data: userDeptRoles } = userIds.length > 0 ? await supabase
      .from('user_department_roles')
      .select('user_id, department_id')
      .in('user_id', userIds)
      .eq('organization_id', orgId)
      : { data: [] };

    // Create map of user departments: userId -> Set of department IDs
    const userDepartmentsMap = new Map<string, Set<string>>();
    userDeptRoles?.forEach((role: any) => {
      if (!userDepartmentsMap.has(role.user_id)) {
        userDepartmentsMap.set(role.user_id, new Set());
      }
      userDepartmentsMap.get(role.user_id)?.add(role.department_id);
    });

    // Check for existing invitations
    const { data: existingInvitations } = await supabase
      .from('invitations')
      .select('email, department_id')
      .eq('organization_id', orgId)
      .in('email', emails)
      .eq('status', 'pending');

    // Create map of pending invitations: email -> Set of department IDs
    const existingInvitationMap = new Map<string, Set<string>>();
    existingInvitations?.forEach((inv: any) => {
      const email = inv.email.toLowerCase();
      if (!existingInvitationMap.has(email)) {
        existingInvitationMap.set(email, new Set());
      }
      existingInvitationMap.get(email)?.add(inv.department_id);
    });
    
    // Send invitations
    const results = [];
    
    for (const member of validMembers) {
      try {
        const memberEmail = member.email.toLowerCase();
        const memberDeptId = member.department;

        // Check if user already exists
        const existingUser = existingUserMap.get(memberEmail);
        if (existingUser) {
          // User exists - check if they're already in this department
          const userDepts = userDepartmentsMap.get(existingUser.id) || new Set();
          
          if (userDepts.has(memberDeptId)) {
            // User already exists in this department
            results.push({
              email: member.email,
              success: false,
              message: 'User already exists in this department'
            });
            continue;
          }
          
          // User exists but in different department - just send email, don't save invitation
          const departmentName = departmentMap[memberDeptId];
          
          // Get Member role for adding to new department
          const { data: memberRole } = await supabase
            .from("global_roles")
            .select("id")
            .eq("name", "Member")
            .single();

          if (memberRole) {
            // Add user to new department directly
            const { error: deptRoleError } = await supabase
              .from("user_department_roles")
              .insert({
                user_id: existingUser.id,
                department_id: memberDeptId,
                organization_id: orgId,
                role_id: memberRole.id
              });

            if (deptRoleError) {
              console.error("Failed to add existing user to department:", deptRoleError);
              results.push({
                email: member.email,
                success: false,
                message: 'Failed to add user to new department'
              });
              continue;
            }
          }

          // Send email notification about new department access
          const emailResult = await invitationService.sendExistingUserDepartmentNotification({
            email: member.email,
            name: existingUser.name || member.name || 'User',
            organizationName: organization.name,
            departmentName: departmentName
          });

          if (emailResult.success) {
            results.push({
              email: member.email,
              success: true,
              message: 'Existing user added to new department and notified'
            });
          } else {
            results.push({
              email: member.email,
              success: false,
              message: 'User added to department but failed to send notification email'
            });
          }
          continue;
        }

        // Check if already invited to this specific department
        const invitedDepts = existingInvitationMap.get(memberEmail);
        if (invitedDepts?.has(memberDeptId)) {
          results.push({
            email: member.email,
            success: false,
            message: 'User already invited to this department and pending registration'
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