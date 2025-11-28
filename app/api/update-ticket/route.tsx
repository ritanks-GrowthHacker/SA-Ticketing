import { NextRequest, NextResponse } from 'next/server';
// import { supabase } from '../../db/connections';
import { db, tickets, projects, users, userOrganizationRoles, userDepartmentRoles, statuses, priorities, userProject, sharedProjects, notifications, activityLogs, globalRoles, eq, and, or, isNull } from '@/lib/db-helper';
import jwt from 'jsonwebtoken';
import { emailService } from '../../../lib/emailService';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface DecodedToken {
  userId: string;
  org_id: string;
  role: string;
  sub: string;
}

interface UpdateTicketRequest {
  ticket_id: string;
  description?: string;
  status_id?: string;
  priority_id?: string;
  assigned_to?: string;
  expected_closing_date?: string; // Allow updating expected date
}

export async function PUT(request: NextRequest) {
  try {
    // Extract JWT token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization token required' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    let decoded: DecodedToken;

    try {
      decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Parse request body
    let body: UpdateTicketRequest;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { ticket_id, description, status_id, priority_id, assigned_to, expected_closing_date } = body;

    if (!ticket_id) {
      return NextResponse.json(
        { error: 'Ticket ID is required' },
        { status: 400 }
      );
    }

    // Validate expected_closing_date if provided
    if (expected_closing_date !== undefined) {
      if (expected_closing_date !== null && expected_closing_date !== '') {
        const expectedDate = new Date(expected_closing_date);
        if (isNaN(expectedDate.getTime())) {
          return NextResponse.json(
            { error: 'Invalid expected_closing_date format. Use ISO date string.' },
            { status: 400 }
          );
        }
      }
    }

    // First, fetch the existing ticket to check permissions
    const existingTicket = await db.select({
      id: tickets.id,
      projectId: tickets.projectId,
      createdBy: tickets.createdBy,
      assignedTo: tickets.assignedTo,
      title: tickets.title,
      description: tickets.description,
      statusId: tickets.statusId,
      priorityId: tickets.priorityId
    })
      .from(tickets)
      .where(eq(tickets.id, ticket_id))
      .limit(1)
      .then(rows => rows[0]);

    if (!existingTicket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      );
    }

    // Fetch the project to check organization
    const ticketProject = await db.select({
      id: projects.id,
      organizationId: projects.organizationId
    })
      .from(projects)
      .where(eq(projects.id, existingTicket.projectId))
      .limit(1)
      .then(rows => rows[0]);

    if (!ticketProject) {
      console.error('Project fetch error');
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Debug logging
    console.log('Debug - Organization Check:', {
      ticketId: ticket_id,
      projectId: existingTicket.projectId,
      projectOrgId: ticketProject.organizationId,
      userOrgId: decoded.org_id,
      matches: ticketProject.organizationId === decoded.org_id
    });

    // Check if ticket belongs to user's organization
    if (ticketProject.organizationId !== decoded.org_id) {
      return NextResponse.json(
        { error: 'Access denied - Ticket not found in your organization' },
        { status: 403 }
      );
    }

    // Role-based access control for editing
    const userRole = decoded.role;
    const isCreator = existingTicket.createdBy === decoded.sub || existingTicket.createdBy === decoded.userId;
    const isAssignee = existingTicket.assignedTo === decoded.sub || existingTicket.assignedTo === decoded.userId;

    // Get user's actual organization role
    const userOrgRole = await db.select({
      roleId: userOrganizationRoles.roleId,
      roleName: globalRoles.name
    })
      .from(userOrganizationRoles)
      .innerJoin(globalRoles, eq(userOrganizationRoles.roleId, globalRoles.id))
      .where(and(
        eq(userOrganizationRoles.userId, decoded.sub),
        eq(userOrganizationRoles.organizationId, decoded.org_id)
      ))
      .limit(1)
      .then(rows => rows[0]);

    const actualUserRole = userOrgRole?.roleName || userRole;

    // Check if user has Manager role in the same project
    let isProjectManager = false;
    const userProjectRole = await db.select({
      projectId: userProject.projectId,
      roleId: userProject.roleId,
      roleName: globalRoles.name
    })
      .from(userProject)
      .innerJoin(globalRoles, eq(userProject.roleId, globalRoles.id))
      .where(and(
        eq(userProject.userId, decoded.sub || decoded.userId),
        eq(userProject.projectId, existingTicket.projectId)
      ))
      .limit(1)
      .then((rows: any[]) => rows[0]);
    
    if (userProjectRole && userProjectRole.roleName === 'Manager') {
      isProjectManager = true;
    }

    // Check edit permissions: Admin, Project Manager, Creator, or Assignee
    const canEdit = actualUserRole === 'Admin' || isProjectManager || isCreator || isAssignee;

    if (!canEdit) {
      return NextResponse.json(
        { error: 'Access denied - You can only edit tickets you created, are assigned to, or manage within your projects' },
        { status: 403 }
      );
    }

    // Validate status_id if provided
    if (status_id) {
      const validStatus = await db.select({
        id: statuses.id
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

      if (!validStatus) {
        return NextResponse.json(
          { error: 'Invalid status ID' },
          { status: 400 }
        );
      }
    }

    // Validate priority_id if provided
    if (priority_id) {
      // Check both statuses table (type=priority) and priorities table
      const priorityStatus = await db.select({
        id: statuses.id
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

      if (!priorityStatus) {
        // Check legacy priorities table
        const priorityRow = await db.select({
          id: priorities.id
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

        if (!priorityRow) {
          return NextResponse.json(
            { error: 'Invalid priority ID' },
            { status: 400 }
          );
        }
      }
    }

    // Validate assigned_to if provided
    if (assigned_to) {
      console.log('🔍 Validating assignee:', assigned_to, 'for project:', existingTicket.projectId);
      
      // Check if user exists in organization - try BOTH org and department roles
      const checkUserOrgRole = await db.select({
        userId: userOrganizationRoles.userId,
        organizationId: userOrganizationRoles.organizationId,
        userName: users.name,
        userEmail: users.email,
        userDepartmentId: users.departmentId
      })
        .from(userOrganizationRoles)
        .innerJoin(users, eq(userOrganizationRoles.userId, users.id))
        .where(and(
          eq(userOrganizationRoles.userId, assigned_to),
          eq(userOrganizationRoles.organizationId, decoded.org_id)
        ))
        .limit(1)
        .then(rows => rows[0]);

      const checkUserDeptRole = await db.select({
        userId: userDepartmentRoles.userId,
        organizationId: userDepartmentRoles.organizationId,
        userName: users.name,
        userEmail: users.email,
        userDepartmentId: users.departmentId
      })
        .from(userDepartmentRoles)
        .innerJoin(users, eq(userDepartmentRoles.userId, users.id))
        .where(and(
          eq(userDepartmentRoles.userId, assigned_to),
          eq(userDepartmentRoles.organizationId, decoded.org_id)
        ))
        .limit(1)
        .then(rows => rows[0]);

      // User must have EITHER org role OR department role
      if (!checkUserOrgRole && !checkUserDeptRole) {
        console.error('User not in organization:', {
          user_id: assigned_to,
          organization_id: decoded.org_id,
          orgRole: !!checkUserOrgRole,
          deptRole: !!checkUserDeptRole
        });
        return NextResponse.json(
          { error: 'Invalid assignee - User not found in organization' },
          { status: 400 }
        );
      }

      // Check if current user can assign to this user (department + shared project access)
      const canAssign = await checkAssignmentPermission(
        decoded.sub,
        assigned_to,
        existingTicket.projectId,
        decoded.org_id
      );

      if (!canAssign) {
        return NextResponse.json(
          { error: 'You cannot assign tickets to users outside your department or shared projects' },
          { status: 403 }
        );
      }

      console.log('✅ Assignee validation passed');
    }

    // Prepare update data (only include fields that are provided)
    const updateData: any = {
      updatedBy: decoded.sub,
      updatedAt: new Date()
    };

    if (description !== undefined) {
      updateData.description = description?.trim() || null;
    }

    if (status_id !== undefined) {
      updateData.statusId = status_id;
    }

    if (priority_id !== undefined) {
      // Handle empty string - don't update if empty
      if (priority_id === '' || priority_id === null) {
        updateData.priorityId = null;
      } else {
        updateData.priorityId = priority_id;
      }
    }

    if (assigned_to !== undefined) {
      updateData.assignedTo = assigned_to || null;
    }

    // Check if status is being changed to "Resolved" to capture actual closing date
    if (status_id !== undefined && status_id !== existingTicket.statusId) {
      // Fetch the new status to check if it's "Resolved"
      const newStatus = await db.select({
        name: statuses.name
      })
        .from(statuses)
        .where(eq(statuses.id, status_id))
        .limit(1)
        .then(rows => rows[0]);
      
      // If status is being changed to "Resolved", set actual_closing_date to now
      if (newStatus?.name?.toLowerCase() === 'resolved') {
        updateData.actualClosingDate = new Date();
        console.log('🎉 Ticket being resolved, setting actual_closing_date:', updateData.actualClosingDate.toISOString());
      }
      
      // If status is being changed FROM "Resolved" to something else, clear actual_closing_date
      if (existingTicket.statusId) {
        const oldStatus = await db.select({
          name: statuses.name
        })
          .from(statuses)
          .where(eq(statuses.id, existingTicket.statusId))
          .limit(1)
          .then(rows => rows[0]);
        
        if (oldStatus?.name?.toLowerCase() === 'resolved' && newStatus?.name?.toLowerCase() !== 'resolved') {
          updateData.actualClosingDate = null;
          console.log('⚠️ Ticket being reopened, clearing actual_closing_date');
        }
      }
    }

    // Handle expected_closing_date update (frozen in edit mode - only creator can change)
    if (expected_closing_date !== undefined) {
      // Only allow creator to update expected_closing_date
      if (decoded.sub === existingTicket.createdBy) {
        updateData.expectedClosingDate = expected_closing_date ? new Date(expected_closing_date) : null;
      } else {
        console.log('⚠️ Non-creator attempted to update expected_closing_date, ignoring');
      }
    }

    // Update the ticket
    const updatedTicket = await db.update(tickets)
      .set(updateData)
      .where(eq(tickets.id, ticket_id))
      .returning()
      .then(rows => rows[0]);

    if (!updatedTicket) {
      console.error('Update error');
      return NextResponse.json(
        { error: 'Failed to update ticket' },
        { status: 500 }
      );
    }

    // Log the ticket update activity
    try {
      const changedFields = [];
      if (description !== undefined && description !== existingTicket.description) {
        changedFields.push('description');
      }
      if (status_id && status_id !== existingTicket.statusId) {
        changedFields.push('status');
      }
      if (priority_id && priority_id !== existingTicket.priorityId) {
        changedFields.push('priority');
      }
      if (assigned_to !== undefined && assigned_to !== existingTicket.assignedTo) {
        changedFields.push('assignee');
      }

      if (changedFields.length > 0) {
        await db.insert(activityLogs).values({
          entityType: 'ticket',
          entityId: ticket_id,
          userId: decoded.sub,
          action: 'updated',
          details: { description: `Updated ticket fields: ${changedFields.join(', ')}` },
          createdAt: new Date()
        });
      }
    } catch (activityError) {
      // Don't fail the request if activity logging fails
      console.error('Activity logging error:', activityError);
    }

    // Fetch related data for complete response
    const [project, creator, assignee, updater, status, priority] = await Promise.all([
      // Project
      db.select({
        id: projects.id,
        name: projects.name,
        description: projects.description
      })
        .from(projects)
        .where(eq(projects.id, updatedTicket.projectId))
        .limit(1)
        .then(rows => rows[0] || null),
      
      // Creator
      db.select({
        id: users.id,
        name: users.name,
        email: users.email
      })
        .from(users)
        .where(eq(users.id, updatedTicket.createdBy))
        .limit(1)
        .then(rows => rows[0] || null),
      
      // Assignee (if exists)
      updatedTicket.assignedTo ? db.select({
        id: users.id,
        name: users.name,
        email: users.email
      })
        .from(users)
        .where(eq(users.id, updatedTicket.assignedTo))
        .limit(1)
        .then(rows => rows[0] || null) : Promise.resolve(null),
      
      // Updater
      updatedTicket.updatedBy ? db.select({
        id: users.id,
        name: users.name,
        email: users.email
      })
        .from(users)
        .where(eq(users.id, updatedTicket.updatedBy))
        .limit(1)
        .then(rows => rows[0] || null) : Promise.resolve(null),
      
      // Status (if exists)
      updatedTicket.statusId ? db.select({
        id: statuses.id,
        name: statuses.name,
        type: statuses.type,
        colorCode: statuses.colorCode,
        sortOrder: statuses.sortOrder
      })
        .from(statuses)
        .where(eq(statuses.id, updatedTicket.statusId))
        .limit(1)
        .then(rows => rows[0] || null) : Promise.resolve(null),
      
      // Priority (if exists) - check priorities table
      updatedTicket.priorityId ? db.select({
        id: priorities.id,
        name: priorities.name,
        description: priorities.description,
        colorCode: priorities.colorCode,
        sortOrder: priorities.sortOrder
      })
        .from(priorities)
        .where(eq(priorities.id, updatedTicket.priorityId))
        .limit(1)
        .then(rows => rows[0] || null) : Promise.resolve(null)
    ]);

    // Format the response
    const response = {
      message: 'Ticket updated successfully',
      ticket: {
        id: updatedTicket.id,
        title: updatedTicket.title, // Title is not editable, just returned
        description: updatedTicket.description,
        created_at: updatedTicket.createdAt?.toISOString() || null,
        updated_at: updatedTicket.updatedAt?.toISOString() || null,
        expected_closing_date: updatedTicket.expectedClosingDate?.toISOString() || null,
        actual_closing_date: updatedTicket.actualClosingDate?.toISOString() || null,
        project: project ? {
          id: project.id,
          name: project.name,
          description: project.description
        } : null,
        creator: creator ? {
          id: creator.id,
          name: creator.name,
          email: creator.email
        } : null,
        assignee: assignee ? {
          id: assignee.id,
          name: assignee.name,
          email: assignee.email
        } : null,
        updater: updater ? {
          id: updater.id,
          name: updater.name,
          email: updater.email
        } : null,
        status: status ? {
          id: status.id,
          name: status.name,
          type: status.type,
          color_code: status.colorCode,
          sort_order: status.sortOrder
        } : null,
        priority: priority ? {
          id: priority.id,
          name: priority.name,
          type: 'priority', // Priorities don't have type field, hardcode it
          color_code: priority.colorCode,
          sort_order: priority.sortOrder
        } : null,
        permissions: {
          can_edit: canEdit,
          can_delete: actualUserRole === 'Admin' || isProjectManager || isCreator,
          can_assign: actualUserRole === 'Admin' || isProjectManager,
          is_creator: isCreator,
          is_assignee: isAssignee,
          is_project_manager: isProjectManager
        }
      }
    };

    // Send email notifications about the update
    try {
      await sendTicketUpdateNotifications(
        existingTicket, 
        updateData, 
        updatedTicket, 
        project?.name || 'Unknown Project',
        decoded.sub
      );
    } catch (emailError) {
      console.error('Failed to send update notifications:', emailError);
      // Don't fail the ticket update if email fails
    }

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Update ticket error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// Also support PATCH method for partial updates
export async function PATCH(request: NextRequest) {
  return PUT(request);
}

// Also support POST method for compatibility
export async function POST(request: NextRequest) {
  return PUT(request);
}

// Helper function to send ticket update notifications
async function sendTicketUpdateNotifications(
  oldTicket: any, 
  updateData: any, 
  updatedTicket: any,
  projectName: string,
  updatedById: string
): Promise<void> {
  try {
    // Get updater details
    const updater = await db.select({
      name: users.name,
      email: users.email
    })
      .from(users)
      .where(eq(users.id, updatedById))
      .limit(1)
      .then(rows => rows[0]);

    if (!updater) {
      console.error('Failed to fetch updater details');
      return;
    }

    // Collect all changes
    const changes: Array<{ field: string; oldValue?: string; newValue?: string }> = [];

    // Check for description changes
    if (updateData.description !== undefined && updateData.description !== oldTicket.description) {
      changes.push({
        field: 'description',
        oldValue: oldTicket.description || 'Empty',
        newValue: updateData.description || 'Empty'
      });
    }

    // Check for status changes
    if (updateData.statusId && updateData.statusId !== oldTicket.statusId) {
      const [oldStatus, newStatus] = await Promise.all([
        oldTicket.statusId ? db.select({ name: statuses.name }).from(statuses).where(eq(statuses.id, oldTicket.statusId)).limit(1).then(rows => rows[0] || null) : Promise.resolve(null),
        db.select({ name: statuses.name }).from(statuses).where(eq(statuses.id, updateData.statusId)).limit(1).then(rows => rows[0] || null)
      ]);
      
      changes.push({
        field: 'status',
        oldValue: oldStatus?.name || 'Not Set',
        newValue: newStatus?.name || 'Unknown'
      });
    }

    // Check for priority changes
    if (updateData.priorityId && updateData.priorityId !== oldTicket.priorityId) {
      const [oldPriority, newPriority] = await Promise.all([
        oldTicket.priorityId ? db.select({ name: priorities.name }).from(priorities).where(eq(priorities.id, oldTicket.priorityId)).limit(1).then(rows => rows[0] || null) : Promise.resolve(null),
        db.select({ name: priorities.name }).from(priorities).where(eq(priorities.id, updateData.priorityId)).limit(1).then(rows => rows[0] || null)
      ]);
      
      changes.push({
        field: 'priority',
        oldValue: oldPriority?.name || 'Not Set',
        newValue: newPriority?.name || 'Unknown'
      });
    }

    // Check for assignee changes
    if (updateData.assignedTo !== undefined && updateData.assignedTo !== oldTicket.assignedTo) {
      const [oldAssignee, newAssignee] = await Promise.all([
        oldTicket.assignedTo ? db.select({ name: users.name }).from(users).where(eq(users.id, oldTicket.assignedTo)).limit(1).then(rows => rows[0] || null) : Promise.resolve(null),
        updateData.assignedTo ? db.select({ name: users.name }).from(users).where(eq(users.id, updateData.assignedTo)).limit(1).then(rows => rows[0] || null) : Promise.resolve(null)
      ]);
      
      changes.push({
        field: 'assignee',
        oldValue: oldAssignee?.name || 'Unassigned',
        newValue: newAssignee?.name || 'Unassigned'
      });
    }

    // Only send emails if there are actual changes
    if (changes.length === 0) {
      console.log('No changes detected, skipping email notifications');
      return;
    }

    // Collect unique recipients (creator and assignee, excluding the updater to avoid self-notification)
    const recipients = new Set<string>();

    // Add creator (if different from updater)
    if (oldTicket.createdBy && oldTicket.createdBy !== updatedById) {
      recipients.add(oldTicket.createdBy);
    }

    // Add current assignee (if different from updater)
    if (updatedTicket.assignedTo && updatedTicket.assignedTo !== updatedById) {
      recipients.add(updatedTicket.assignedTo);
    }

    // Add previous assignee if it changed (and different from updater)
    if (updateData.assignedTo !== oldTicket.assignedTo && 
        oldTicket.assignedTo && 
        oldTicket.assignedTo !== updatedById) {
      recipients.add(oldTicket.assignedTo);
    }

    console.log(`📧 Sending update notifications to ${recipients.size} recipients for ticket ${updatedTicket.id}`);

    // Send emails and create in-app notifications for all recipients
    const emailPromises = Array.from(recipients).map(async (recipientId) => {
      try {
        const recipient = await db.select({
          name: users.name,
          email: users.email
        })
          .from(users)
          .where(eq(users.id, recipientId))
          .limit(1)
          .then(rows => rows[0]);

        if (!recipient) {
          console.error(`Failed to fetch recipient details for ${recipientId}`);
          return;
        }

        // Create in-app notification
        const changesText = changes.map(c => c.field).join(', ');
        await db.insert(notifications).values({
          userId: recipientId,
          entityType: 'ticket',
          entityId: updatedTicket.id,
          title: 'Ticket Updated',
          message: `Ticket "${updatedTicket.title}" was updated. Changes: ${changesText}`,
          type: 'info',
          createdAt: new Date()
        });

        // Send email notification
        const emailResult = await emailService.sendTicketUpdateEmail(
          recipient.email,
          updatedTicket.id,
          updatedTicket.title,
          projectName,
          recipient.name,
          updater.name,
          changes
        );

        if (emailResult.success) {
          console.log(`✅ Update notification sent to ${recipient.email} for ticket ${updatedTicket.id}`);
        } else {
          console.error(`❌ Failed to send update notification to ${recipient.email}: ${emailResult.error}`);
        }

      } catch (error) {
        console.error(`Error sending notification to recipient ${recipientId}:`, error);
      }
    });

    await Promise.allSettled(emailPromises);

  } catch (error) {
    console.error('Error in sendTicketUpdateNotifications:', error);
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
    departmentId: users.departmentId
  })
    .from(users)
    .where(eq(users.id, creatorId))
    .limit(1)
    .then(rows => rows[0] || null);

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
    .then(rows => rows[0] || null);

  const creatorRole = creatorOrgRole?.roleName || 'User';
  console.log('🔧 Creator role:', creatorRole, 'department:', creatorData?.departmentId);

  // Org Admins can assign to anyone in the organization
  if (creatorRole === 'Admin') {
    console.log('✅ Org Admin - can assign to anyone');
    return true;
  }

  // Get assignee's department
  const assigneeData = await db.select({
    departmentId: users.departmentId
  })
    .from(users)
    .where(eq(users.id, assigneeId))
    .limit(1)
    .then(rows => rows[0] || null);

  console.log('🔧 Assignee department:', assigneeData?.departmentId);

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
      .then(rows => rows[0] || null);

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
    .then(rows => rows[0] || null);

  if (assigneeProjectAccess) {
    console.log('✅ Assignee has direct project access - can assign');
    return true;
  }

  console.log('❌ Cannot assign - no shared access');
  return false;
}
