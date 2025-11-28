import { NextRequest, NextResponse } from 'next/server';
// import { supabase } from '@/app/db/connections';
import { db, invitations, organizations, departments, eq, and, sql } from '@/lib/db-helper';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, email } = body;
    
    console.log('Verify invitation request:', { token, email, fullBody: body });

    if (!token && !email) {
      return NextResponse.json(
        { error: 'Invitation token or email is required' },
        { status: 400 }
      );
    }

    let invitation;
    let invitationError;

    if (token) {
      // First check if invitation exists and is completed
      const completedResults = await db.select()
        .from(invitations)
        .where(and(
          eq(invitations.invitationToken, token),
          eq(invitations.status, 'completed')
        ))
        .limit(1);

      if (completedResults.length > 0) {
        // Delete completed invitation and show message
        await db.delete(invitations)
          .where(and(
            eq(invitations.invitationToken, token),
            eq(invitations.status, 'completed')
          ));

        return NextResponse.json(
          { error: 'Onboarding already completed! This invitation has been used.' },
          { status: 410 }
        );
      }

      // Find pending invitation by token with nested joins using raw SQL
      const result = await db.execute<{
        id: string;
        organization_id: string;
        department_id: string;
        email: string;
        name: string;
        job_title: string;
        phone: string;
        status: string;
        expires_at: Date;
        org_name: string;
        dept_name: string;
      }>(sql`
        SELECT 
          i.id, i.organization_id, i.department_id, i.email, i.name, i.job_title, i.phone,
          i.status, i.expires_at,
          o.name as org_name,
          d.name as dept_name
        FROM invitations i
        LEFT JOIN organizations o ON i.organization_id = o.id
        LEFT JOIN departments d ON i.department_id = d.id
        WHERE i.invitation_token = ${token}
        AND i.status = 'pending'
        LIMIT 1
      `);
      
      invitation = result.rows[0];
      invitationError = !invitation;
    } else if (email) {
      // First check if invitation exists and is completed
      const completedResults = await db.select()
        .from(invitations)
        .where(and(
          eq(sql`LOWER(${invitations.email})`, email.toLowerCase()),
          eq(invitations.status, 'completed')
        ))
        .limit(1);

      if (completedResults.length > 0) {
        // Delete completed invitation and show message
        await db.delete(invitations)
          .where(and(
            eq(sql`LOWER(${invitations.email})`, email.toLowerCase()),
            eq(invitations.status, 'completed')
          ));

        return NextResponse.json(
          { error: 'Onboarding already completed! This email has already been registered.' },
          { status: 410 }
        );
      }

      // Find pending invitation by email with nested joins
      const result = await db.execute<{
        id: string;
        organization_id: string;
        department_id: string;
        email: string;
        name: string;
        job_title: string;
        phone: string;
        status: string;
        expires_at: Date;
        org_name: string;
        dept_name: string;
      }>(sql`
        SELECT 
          i.id, i.organization_id, i.department_id, i.email, i.name, i.job_title, i.phone,
          i.status, i.expires_at,
          o.name as org_name,
          d.name as dept_name
        FROM invitations i
        LEFT JOIN organizations o ON i.organization_id = o.id
        LEFT JOIN departments d ON i.department_id = d.id
        WHERE LOWER(i.email) = ${email.toLowerCase()}
        AND i.status = 'pending'
        ORDER BY i.created_at DESC
        LIMIT 1
      `);
      
      invitation = result.rows[0];
      invitationError = !invitation;
    }

    if (invitationError || !invitation) {
      return NextResponse.json(
        { error: 'Invalid or expired invitation' },
        { status: 404 }
      );
    }

    // Check if invitation has expired
    const expirationDate = new Date(invitation.expires_at);
    if (expirationDate < new Date()) {
      // Update status to expired
      await db.update(invitations)
        .set({ status: 'expired' })
        .where(eq(invitations.id, invitation.id));

      return NextResponse.json(
        { error: 'Invitation has expired' },
        { status: 410 }
      );
    }

    // Return invitation details for registration form
    return NextResponse.json({
      invitation: {
        id: invitation.id,
        email: invitation.email,
        name: invitation.name,
        jobTitle: invitation.job_title,
        phone: invitation.phone,
        organizationId: invitation.organization_id,
        organizationName: invitation.org_name,
        departmentId: invitation.department_id,
        departmentName: invitation.dept_name
      }
    });

  } catch (error) {
    console.error('Error verifying invitation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}