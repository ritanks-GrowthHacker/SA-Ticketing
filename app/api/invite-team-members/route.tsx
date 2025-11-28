import { NextRequest, NextResponse } from 'next/server';
// import { supabase } from '@/app/db/connections';
import { db, organizations, departments, users, globalRoles, userDepartmentRoles, invitations, eq, inArray, and, sql } from '@/lib/db-helper';
import { InvitationEmailService } from '../../../lib/invitationEmailService';
import crypto from 'crypto';

const invitationService = new InvitationEmailService();

interface TeamMember {
  email: string;
  department: string;
  name?: string;
  role?: string;
  phone?: string;
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

    // Get organization details
    const orgResults = await db.select({
      name: organizations.name,
      domain: organizations.domain,
      associatedDepartments: organizations.associatedDepartments
    })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);
    
    const organization = orgResults[0];

    if (!organization) {
      console.error('Error fetching organization');
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
    const depts = await db.select({
      id: departments.id,
      name: departments.name
    })
      .from(departments)
      .where(and(
        inArray(departments.id, departmentIds),
        eq(departments.isActive, true)
      ));

    if (!depts || depts.length === 0) {
      console.error('Error fetching departments');
      return NextResponse.json(
        { error: 'Failed to validate departments' },
        { status: 500 }
      );
    }

    // Create department lookup map
    const departmentMap = depts.reduce((map: Record<string, string>, dept: any) => {
      map[dept.id] = dept.name;
      return map;
    }, {} as Record<string, string>);

    // Check for existing users WITH their department associations
    const emails = validMembers.map(m => m.email.toLowerCase());
    
    // Fix: Use inArray helper or cast to array properly
    const existingUsers = await db.select({
      id: users.id,
      email: users.email,
      name: users.name,
      departmentId: users.departmentId
    })
      .from(users)
      .where(sql`LOWER(${users.email}) = ANY(${sql.raw(`ARRAY[${emails.map(e => `'${e}'`).join(',')}]`)})`);

    // Create map of existing users: email -> user data
    const existingUserMap = new Map(
      existingUsers?.map((u) => [u.email.toLowerCase(), u]) || []
    );

    // Also check user_department_roles for all department associations
    const userIds = existingUsers?.map((u) => u.id) || [];
    const userDeptRoles = userIds.length > 0 ? await db.select({
      userId: userDepartmentRoles.userId,
      departmentId: userDepartmentRoles.departmentId
    })
      .from(userDepartmentRoles)
      .where(and(
        inArray(userDepartmentRoles.userId, userIds),
        eq(userDepartmentRoles.organizationId, orgId)
      ))
      : [];

    // Create map of user departments: userId -> Set of department IDs
    const userDepartmentsMap = new Map<string, Set<string>>();
    userDeptRoles?.forEach((role) => {
      if (!userDepartmentsMap.has(role.userId)) {
        userDepartmentsMap.set(role.userId, new Set());
      }
      userDepartmentsMap.get(role.userId)?.add(role.departmentId);
    });

    // Check for existing invitations
    const existingInvs = await db.select({
      email: invitations.email,
      departmentId: invitations.departmentId
    })
      .from(invitations)
      .where(and(
        eq(invitations.organizationId, orgId),
        inArray(invitations.email, emails),
        eq(invitations.status, 'pending')
      ));

    // Create map of pending invitations: email -> Set of department IDs
    const existingInvitationMap = new Map<string, Set<string>>();
    existingInvs?.forEach((inv) => {
      const email = inv.email.toLowerCase();
      if (!existingInvitationMap.has(email)) {
        existingInvitationMap.set(email, new Set());
      }
      existingInvitationMap.get(email)?.add(inv.departmentId);
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
          const memberRoleResults = await db.select({
            id: globalRoles.id
          })
            .from(globalRoles)
            .where(eq(globalRoles.name, 'Member'))
            .limit(1);
          
          const memberRole = memberRoleResults[0];

          if (memberRole) {
            // Add user to new department directly
            try {
              await db.insert(userDepartmentRoles).values({
                userId: existingUser.id,
                departmentId: memberDeptId,
                organizationId: orgId,
                roleId: memberRole.id
              });
            } catch (deptRoleError) {
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
        const invitationToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        const invitationResults = await db.insert(invitations).values({
          organizationId: orgId,
          departmentId: member.department,
          email: member.email.toLowerCase(),
          name: member.name,
          jobTitle: member.role,
          phone: member.phone || null,
          invitationToken: invitationToken,
          expiresAt: expiresAt
        }).returning();

        const invitation = invitationResults[0];

        if (!invitation) {
          console.error('Error saving invitation');
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
          invitationToken: invitation.invitationToken
        });

        if (emailResult.success) {
          results.push({
            email: member.email,
            success: true,
            message: 'Invitation sent successfully'
          });
        } else {
          // If email fails, remove the invitation from database
          await db.delete(invitations)
            .where(eq(invitations.id, invitation.id));
          
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