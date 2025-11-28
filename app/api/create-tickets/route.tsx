import { NextRequest, NextResponse } from 'next/server';
// import { supabase } from '../../db/connections';
import { db, projects, users, userOrganizationRoles, userDepartmentRoles, statuses, priorities, tickets, activityLogs, notifications, globalRoles, projectDepartment, sharedProjects, userProject, eq, and, or, isNull, desc } from '@/lib/db-helper';
import jwt from 'jsonwebtoken';
import { emailService } from '../../../lib/emailService';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface DecodedToken {
  userId: string;
  org_id: string;
  role: string;
  sub: string;
}

interface CreateTicketRequest {
  project_id: string;
  title: string;
  description?: string;
  status_id?: string;
  priority_id?: string;
  assigned_to?: string;
  expected_closing_date?: string; // ISO date string for expected completion
}

export async function POST(request: NextRequest) {
  try {
    console.log('🎫 CREATE TICKET API - Request received');
    
    // Extract JWT token from Authorization header
    const authHeader = request.headers.get('authorization');
    console.log('🔧 Auth header:', authHeader ? 'Present' : 'Missing');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ Missing or invalid auth header');
      return NextResponse.json(
        { error: 'Authorization token required' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    let decoded: DecodedToken;

    try {
      decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;
      console.log('✅ Token decoded:', { userId: decoded.sub, orgId: decoded.org_id, role: decoded.role });
    } catch (error) {
      console.log('❌ Token verification failed:', error);
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Parse request body
    let body: CreateTicketRequest;
    try {
      body = await request.json();
      console.log('📝 Request body:', body);
    } catch (error) {
      console.log('❌ JSON parsing failed:', error);
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const { project_id, title, description, status_id, priority_id, assigned_to, expected_closing_date } = body;

    // Validate required fields
    if (!project_id || !title) {
      return NextResponse.json(
        { error: 'project_id and title are required' },
        { status: 400 }
      );
    }

    // Validate expected_closing_date if provided
    if (expected_closing_date) {
      const expectedDate = new Date(expected_closing_date);
      if (isNaN(expectedDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid expected_closing_date format. Use ISO date string.' },
          { status: 400 }
        );
      }
      // Check if date is not in the past
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (expectedDate < today) {
        return NextResponse.json(
          { error: 'Expected closing date cannot be in the past' },
          { status: 400 }
        );
      }
    }

    // Verify project exists and belongs to user's organization
    const project = await db.select({
      id: projects.id,
      name: projects.name,
      organizationId: projects.organizationId
    })
      .from(projects)
      .where(eq(projects.id, project_id))
      .limit(1)
      .then(rows => rows[0]);

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check if project belongs to user's organization
    if (project.organizationId !== decoded.org_id) {
      return NextResponse.json(
        { error: 'Project does not belong to your organization' },
        { status: 403 }
      );
    }

    // Check user's permission to create tickets in this project
    const canCreateTicket = await checkUserProjectPermission(decoded.sub, project_id, decoded.role, decoded.org_id);
    if (!canCreateTicket) {
      return NextResponse.json(
        { error: 'You do not have permission to create tickets in this project' },
        { status: 403 }
      );
    }

    // Validate assigned_to user if provided
    if (assigned_to) {
      console.log('🔧 Validating assignee:', assigned_to, 'in organization:', decoded.org_id);
      
      // First check if user exists in the organization's users table
      const userExists = await db.select({
        id: users.id,
        name: users.name,
        email: users.email,
        organizationId: users.organizationId,
        departmentId: users.departmentId
      })
        .from(users)
        .where(and(
          eq(users.id, assigned_to),
          eq(users.organizationId, decoded.org_id)
        ))
        .limit(1)
        .then(rows => rows[0]);

      console.log('🔧 User existence check:', { 
        userExists: !!userExists,
        userData: userExists 
      });

      if (!userExists) {
        return NextResponse.json(
          { error: 'Assigned user not found in your organization' },
          { status: 400 }
        );
      }

      // Check if user has any role (org-level or dept-level)
      const orgRole = await db.select({
        userId: userOrganizationRoles.userId,
        organizationId: userOrganizationRoles.organizationId
      })
        .from(userOrganizationRoles)
        .where(and(
          eq(userOrganizationRoles.userId, assigned_to),
          eq(userOrganizationRoles.organizationId, decoded.org_id)
        ))
        .limit(1)
        .then(rows => rows[0]);

      const deptRole = await db.select({
        userId: userDepartmentRoles.userId,
        organizationId: userDepartmentRoles.organizationId,
        departmentId: userDepartmentRoles.departmentId
      })
        .from(userDepartmentRoles)
        .where(and(
          eq(userDepartmentRoles.userId, assigned_to),
          eq(userDepartmentRoles.organizationId, decoded.org_id)
        ))
        .limit(1)
        .then(rows => rows[0]);

      console.log('🔧 Role validation result:', { 
        hasOrgRole: !!orgRole, 
        hasDeptRole: !!deptRole
      });

      // User must have at least one role OR be in the organization
      if (!orgRole && !deptRole && !userExists) {
        return NextResponse.json(
          { error: 'Assigned user does not have proper access in your organization' },
          { status: 400 }
        );
      }

      // Check if creator can assign to this user based on department and shared project access
      const canAssign = await checkAssignmentPermission(
        decoded.sub,
        assigned_to,
        project_id,
        decoded.org_id
      );

      if (!canAssign) {
        return NextResponse.json(
          { error: 'You cannot assign tickets to users outside your department or shared projects' },
          { status: 403 }
        );
      }
    }

    // Validate status_id if provided
    if (status_id) {
      console.log('🔧 Validating status_id:', status_id);
      const status = await db.select({
        id: statuses.id,
        name: statuses.name,
        type: statuses.type
      })
        .from(statuses)
        .where(and(
          eq(statuses.id, status_id),
          or(
            eq(statuses.organizationId, decoded.org_id),
            isNull(statuses.organizationId)
          ),
          eq(statuses.type, 'ticket'),
          eq(statuses.isActive, true)
        ))
        .limit(1)
        .then(rows => rows[0]);

      console.log('🔧 Status validation result:', { status });

      if (!status) {
        console.log('❌ Invalid status_id:', 'Status not found');
        return NextResponse.json(
          { error: 'Invalid status_id for ticket' },
          { status: 400 }
        );
      }
    }

    // Validate priority_id if provided
    if (priority_id) {
      console.log('🔧 Validating priority_id:', priority_id);

      // First try the new `statuses` table where type='priority' (supports global NULL org_id)
      const priorityStatus = await db.select({
        id: statuses.id,
        name: statuses.name,
        type: statuses.type
      })
        .from(statuses)
        .where(and(
          eq(statuses.id, priority_id),
          or(
            eq(statuses.organizationId, decoded.org_id),
            isNull(statuses.organizationId)
          ),
          eq(statuses.type, 'priority'),
          eq(statuses.isActive, true)
        ))
        .limit(1)
        .then(rows => rows[0]);

      if (priorityStatus) {
        console.log('🔧 Priority found in `statuses` table:', priorityStatus);
      } else {
        // Backwards-compatible: check legacy `priorities` table
        const priorityRow = await db.select({
          id: priorities.id,
          name: priorities.name,
          description: priorities.description,
          colorCode: priorities.colorCode,
          sortOrder: priorities.sortOrder,
          isActive: priorities.isActive
        })
          .from(priorities)
          .where(and(
            eq(priorities.id, priority_id),
            or(
              eq(priorities.organizationId, decoded.org_id),
              isNull(priorities.organizationId)
            ),
            eq(priorities.isActive, true)
          ))
          .limit(1)
          .then(rows => rows[0]);

        console.log('🔧 Priority lookup in `priorities` table result:', priorityRow);

        if (!priorityRow) {
          console.log('❌ Invalid priority_id: not found in statuses or priorities');
          return NextResponse.json(
            { error: 'Invalid priority_id' },
            { status: 400 }
          );
        }
      }
    }

    // Get default status if not provided
    let finalStatusId = status_id;
    if (!finalStatusId) {
      const defaultStatus = await db.select({
        id: statuses.id
      })
        .from(statuses)
        .where(and(
          or(
            eq(statuses.organizationId, decoded.org_id),
            isNull(statuses.organizationId)
          ),
          eq(statuses.type, 'ticket'),
          eq(statuses.isActive, true)
        ))
        .orderBy(statuses.sortOrder)
        .limit(1)
        .then(rows => rows[0]);

      finalStatusId = defaultStatus?.id;
    }

    // Create the ticket
    const newTicket = await db.insert(tickets)
      .values({
        projectId: project_id,
        createdBy: decoded.sub,
        assignedTo: assigned_to || null,
        title: title.trim(),
        description: description?.trim() || null,
        statusId: finalStatusId,
        priorityId: priority_id || null,
        expectedClosingDate: expected_closing_date ? new Date(expected_closing_date) : null,
        updatedBy: decoded.sub
      })
      .returning()
      .then(rows => rows[0]);

    if (!newTicket) {
      console.error('Error creating ticket');
      return NextResponse.json(
        { error: 'Failed to create ticket' },
        { status: 500 }
      );
    }

    // Log activity
    await db.insert(activityLogs)
      .values({
        userId: decoded.sub,
        entityType: 'ticket',
        entityId: newTicket.id,
        action: 'created',
        details: {
          ticket_title: title,
          project_name: project.name,
          assigned_to: assigned_to || null
        }
      })
      .catch(err => console.error('Activity log error:', err));

    // Send notifications (email + in-app) if ticket is assigned to someone other than creator
    if (assigned_to && assigned_to !== decoded.sub) {
      try {
        // Create in-app notification
        await db.insert(notifications)
          .values({
            userId: assigned_to,
            entityType: 'ticket',
            entityId: newTicket.id,
            title: 'New Ticket Assigned',
            message: `You have been assigned to ticket "${title}" in project "${project.name}"`,
            type: 'info'
          });

        // Send email notification
        await sendTicketAssignmentNotification(assigned_to, newTicket, project.name, decoded.sub);
      } catch (emailError) {
        console.error('Failed to send assignment notifications:', emailError);
        // Don't fail the ticket creation if email fails
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Ticket created successfully',
        ticket: newTicket
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Error in create-tickets:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to check if user can assign tickets to another user
async function checkAssignmentPermission(
  creatorId: string,
  assigneeId: string,
  projectId: string,
  orgId: string
): Promise<boolean> {
  console.log('🔧 Checking assignment permission:', { creatorId, assigneeId, projectId, orgId });

  // Get creator's role and department
  const creatorData = await db.select({
    departmentId: users.departmentId,
    organizationId: users.organizationId
  })
    .from(users)
    .where(eq(users.id, creatorId))
    .limit(1)
    .then(rows => rows[0]);

  const creatorOrgRole = await db.select({
    roleId: userOrganizationRoles.roleId,
    roleName: globalRoles.name
  })
    .from(userOrganizationRoles)
    .innerJoin(globalRoles, eq(userOrganizationRoles.roleId, globalRoles.id))
    .where(and(
      eq(userOrganizationRoles.userId, creatorId),
      eq(userOrganizationRoles.organizationId, orgId)
    ))
    .limit(1)
    .then(rows => rows[0]);

  const creatorDeptRole = await db.select({
    roleId: userDepartmentRoles.roleId,
    roleName: globalRoles.name
  })
    .from(userDepartmentRoles)
    .innerJoin(globalRoles, eq(userDepartmentRoles.roleId, globalRoles.id))
    .where(and(
      eq(userDepartmentRoles.userId, creatorId),
      eq(userDepartmentRoles.organizationId, orgId)
    ))
    .limit(1)
    .then(rows => rows[0]);

  const creatorRole = creatorOrgRole?.roleName || creatorDeptRole?.roleName || 'User';
  console.log('🔧 Creator role:', creatorRole, 'department:', creatorData?.departmentId);

  // Org Admins can assign to anyone in the organization
  if (creatorRole === 'Admin') {
    console.log('✅ Org Admin - can assign to anyone');
    return true;
  }

  // Get assignee's organization and department
  const assigneeData = await db.select({
    departmentId: users.departmentId,
    organizationId: users.organizationId
  })
    .from(users)
    .where(eq(users.id, assigneeId))
    .limit(1)
    .then(rows => rows[0]);

  console.log('🔧 Assignee department:', assigneeData?.departmentId);

  // If both users are in the same organization, allow assignment
  if (creatorData?.organizationId === assigneeData?.organizationId) {
    console.log('✅ Same organization - can assign');
    return true;
  }

  // Check if users are in the same department
  if (creatorData?.departmentId && assigneeData?.departmentId) {
    if (creatorData.departmentId === assigneeData.departmentId) {
      console.log('✅ Same department - can assign');
      return true;
    }
  }

  // Check if the project is shared with assignee's department
  if (assigneeData?.departmentId) {
    const sharedProject = await db.select({
      projectId: sharedProjects.projectId,
      departmentId: sharedProjects.departmentId
    })
      .from(sharedProjects)
      .where(and(
        eq(sharedProjects.projectId, projectId),
        eq(sharedProjects.departmentId, assigneeData.departmentId)
      ))
      .limit(1)
      .then(rows => rows[0]);

    if (sharedProject) {
      console.log('✅ Project shared with assignee department - can assign');
      return true;
    }
  }

  // Check if assignee has direct access to the project via user_project
  const assigneeProjectAccess = await db.select({
    userId: userProject.userId
  })
    .from(userProject)
    .where(and(
      eq(userProject.userId, assigneeId),
      eq(userProject.projectId, projectId)
    ))
    .limit(1)
    .then(rows => rows[0]);

  if (assigneeProjectAccess) {
    console.log('✅ Assignee has direct project access - can assign');
    return true;
  }

  console.log('❌ Cannot assign - no shared access');
  return false;
}

// Helper function to check if user can create tickets in a project
async function checkUserProjectPermission(userId: string, projectId: string, userRole: string, orgId: string): Promise<boolean> {
  console.log('🔧 Checking user project permission:', { userId, projectId, userRole, orgId });

  // Get user's organization role and department
  const userOrgRole = await db.select({
    roleId: userOrganizationRoles.roleId,
    roleName: globalRoles.name
  })
    .from(userOrganizationRoles)
    .innerJoin(globalRoles, eq(userOrganizationRoles.roleId, globalRoles.id))
    .where(and(
      eq(userOrganizationRoles.userId, userId),
      eq(userOrganizationRoles.organizationId, orgId)
    ))
    .limit(1)
    .then(rows => rows[0]);

  const userDeptRole = await db.select({
    roleId: userDepartmentRoles.roleId,
    roleName: globalRoles.name
  })
    .from(userDepartmentRoles)
    .innerJoin(globalRoles, eq(userDepartmentRoles.roleId, globalRoles.id))
    .where(and(
      eq(userDepartmentRoles.userId, userId),
      eq(userDepartmentRoles.organizationId, orgId)
    ))
    .limit(1)
    .then(rows => rows[0]);

  let actualUserRole = userRole; // fallback to JWT role
  if (userOrgRole && userOrgRole.roleName) {
    actualUserRole = userOrgRole.roleName;
  } else if (userDeptRole && userDeptRole.roleName) {
    actualUserRole = userDeptRole.roleName;
  }

  console.log('🔧 Actual user role:', actualUserRole);

  // Org Admins can create tickets in any project within their organization
  if (actualUserRole === 'Admin') {
    console.log('✅ Org Admin - can create tickets in any project');
    return true;
  }

  // Get user's department
  const userData = await db.select({
    departmentId: users.departmentId
  })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
    .then(rows => rows[0]);

  console.log('🔧 User department:', userData?.departmentId);

  // Check if project belongs to user's department
  if (userData?.departmentId) {
    const projectDept = await db.select({
      projectId: projectDepartment.projectId,
      departmentId: projectDepartment.departmentId
    })
      .from(projectDepartment)
      .where(and(
        eq(projectDepartment.projectId, projectId),
        eq(projectDepartment.departmentId, userData.departmentId)
      ))
      .limit(1)
      .then(rows => rows[0]);

    if (projectDept) {
      console.log('✅ Project belongs to user department - can create tickets');
      return true;
    }

    // Check if project is shared with user's department
    const sharedProject = await db.select({
      projectId: sharedProjects.projectId,
      departmentId: sharedProjects.departmentId
    })
      .from(sharedProjects)
      .where(and(
        eq(sharedProjects.projectId, projectId),
        eq(sharedProjects.departmentId, userData.departmentId)
      ))
      .limit(1)
      .then(rows => rows[0]);

    if (sharedProject) {
      console.log('✅ Project shared with user department - can create tickets');
      return true;
    }
  }

  // For Managers and regular users, check if they are directly assigned to the project
  const userProjectData = await db.select({
    userId: userProject.userId,
    projectId: userProject.projectId
  })
    .from(userProject)
    .where(and(
      eq(userProject.userId, userId),
      eq(userProject.projectId, projectId)
    ))
    .limit(1)
    .then(rows => rows[0]);

  console.log('🔧 User project assignment:', { userProjectData });

  if (!userProjectData) {
    console.log('❌ User has no access to this project');
    return false;
  }

  // If user is assigned to project, they can create tickets
  console.log('✅ User assigned to project - can create tickets');
  return true;
}

// Helper function to send ticket assignment notification
async function sendTicketAssignmentNotification(assignedUserId: string, ticket: any, projectName: string, createdById: string): Promise<void> {
  try {
    // Get assignee user details
    const assignee = await db.select({
      name: users.name,
      email: users.email
    })
      .from(users)
      .where(eq(users.id, assignedUserId))
      .limit(1)
      .then(rows => rows[0]);

    if (!assignee) {
      console.error('Failed to fetch assignee details');
      return;
    }

    // Get creator user details
    const creator = await db.select({
      name: users.name
    })
      .from(users)
      .where(eq(users.id, createdById))
      .limit(1)
      .then(rows => rows[0]);

    if (!creator) {
      console.error('Failed to fetch creator details');
      return;
    }

    // Get status and priority names if they exist
    let statusName = '';
    let priorityName = '';

    if (ticket.status_id) {
      const status = await db.select({
        name: statuses.name
      })
        .from(statuses)
        .where(eq(statuses.id, ticket.status_id))
        .limit(1)
        .then(rows => rows[0]);
      statusName = status?.name || '';
    }

    if (ticket.priority_id) {
      const priority = await db.select({
        name: statuses.name
      })
        .from(statuses)
        .where(eq(statuses.id, ticket.priority_id))
        .limit(1)
        .then(rows => rows[0]);
      priorityName = priority?.name || '';
    }

    // Send the assignment email
    const emailResult = await emailService.sendTicketAssignmentEmail(
      assignee.email,
      ticket.id,
      ticket.title,
      ticket.description || '',
      projectName,
      assignee.name,
      creator.name,
      priorityName,
      statusName
    );

    if (emailResult.success) {
      console.log(`✅ Assignment email sent to ${assignee.email} for ticket ${ticket.id}`);
    } else {
      console.error(`❌ Failed to send assignment email: ${emailResult.error}`);
    }

  } catch (error) {
    console.error('Error in sendTicketAssignmentNotification:', error);
  }
}
