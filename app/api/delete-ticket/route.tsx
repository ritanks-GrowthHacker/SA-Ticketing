import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../db/connections';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface DecodedToken {
  userId: string;
  org_id: string;
  role: string;
  sub: string;
}

export async function DELETE(request: NextRequest) {
  try {
    console.log('🗑️ DELETE TICKET API - Request received');
    
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

    // Get ticket_id from query params
    const { searchParams } = new URL(request.url);
    const ticket_id = searchParams.get('ticket_id');

    if (!ticket_id) {
      return NextResponse.json(
        { error: 'ticket_id is required' },
        { status: 400 }
      );
    }

    console.log('🔧 Deleting ticket:', ticket_id);

    // Fetch the existing ticket to check permissions
    const { data: existingTicket, error: fetchError } = await supabase
      .from('tickets')
      .select(`
        id,
        project_id,
        created_by,
        title,
        projects!inner(id, name, organization_id)
      `)
      .eq('id', ticket_id)
      .single();

    if (fetchError || !existingTicket) {
      console.log('❌ Ticket not found:', fetchError);
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      );
    }

    // Check if ticket belongs to user's organization
    const project = (existingTicket as any).projects;
    if (!project || project.organization_id !== decoded.org_id) {
      return NextResponse.json(
        { error: 'Access denied - Ticket not found in your organization' },
        { status: 403 }
      );
    }

    // Get user's organization role
    const { data: userOrgRole } = await supabase
      .from('user_organization_roles')
      .select(`
        role_id,
        global_roles!user_organization_roles_role_id_fkey(name)
      `)
      .eq('user_id', decoded.sub)
      .eq('organization_id', decoded.org_id)
      .single();

    const actualUserRole = (userOrgRole?.global_roles as any)?.name || decoded.role;
    console.log('🔧 User role:', actualUserRole);

    // Check delete permissions
    let canDelete = false;

    // Org Admins can delete any ticket
    if (actualUserRole === 'Admin') {
      console.log('✅ Org Admin - can delete any ticket');
      canDelete = true;
    } else {
      // Check if user is the creator
      const isCreator = existingTicket.created_by === decoded.sub;
      
      if (isCreator) {
        console.log('✅ User is ticket creator - can delete');
        canDelete = true;
      } else {
        // Check if user is a Manager in this project
        const { data: userProjectRole } = await supabase
          .from('user_project')
          .select(`
            project_id, role_id,
            global_roles!user_project_role_id_fkey(name)
          `)
          .eq('user_id', decoded.sub)
          .eq('project_id', existingTicket.project_id)
          .single();

        if (userProjectRole && (userProjectRole as any).global_roles?.name === 'Manager') {
          console.log('✅ User is project Manager - can delete');
          canDelete = true;
        }
      }
    }

    if (!canDelete) {
      return NextResponse.json(
        { error: 'Access denied - You can only delete tickets you created or manage' },
        { status: 403 }
      );
    }

    // Delete related data first (due to foreign key constraints)
    // Delete ticket activities
    await supabase
      .from('ticket_activities')
      .delete()
      .eq('ticket_id', ticket_id);

    // Delete ticket comments if any
    await supabase
      .from('ticket_comments')
      .delete()
      .eq('ticket_id', ticket_id);

    // Delete notifications related to this ticket
    await supabase
      .from('notifications')
      .delete()
      .eq('entity_type', 'ticket')
      .eq('entity_id', ticket_id);

    // Delete the ticket
    const { error: deleteError } = await supabase
      .from('tickets')
      .delete()
      .eq('id', ticket_id);

    if (deleteError) {
      console.error('Error deleting ticket:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete ticket' },
        { status: 500 }
      );
    }

    // Log activity
    await supabase
      .from('activity_logs')
      .insert({
        user_id: decoded.sub,
        entity_type: 'ticket',
        entity_id: ticket_id,
        action: 'deleted',
        details: {
          ticket_title: existingTicket.title,
          project_name: project.name
        }
      });

    console.log('✅ Ticket deleted successfully:', ticket_id);

    return NextResponse.json(
      {
        success: true,
        message: 'Ticket deleted successfully'
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error in delete-ticket:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
