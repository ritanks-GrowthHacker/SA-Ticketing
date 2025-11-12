import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/db/connections';

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
      const completedResult = await supabase
        .from('invitations')
        .select('status')
        .eq('invitation_token', token)
        .eq('status', 'completed')
        .single();

      if (completedResult.data) {
        // Delete completed invitation and show message
        await supabase
          .from('invitations')
          .delete()
          .eq('invitation_token', token)
          .eq('status', 'completed');

        return NextResponse.json(
          { error: 'Onboarding already completed! This invitation has been used.' },
          { status: 410 }
        );
      }

      // Find pending invitation by token
      const result = await supabase
        .from('invitations')
        .select(`
          *,
          organizations (name),
          departments (name)
        `)
        .eq('invitation_token', token)
        .eq('status', 'pending')
        .single();
      
      invitation = result.data;
      invitationError = result.error;
    } else if (email) {
      // First check if invitation exists and is completed
      const completedResult = await supabase
        .from('invitations')
        .select('status')
        .eq('email', email.toLowerCase())
        .eq('status', 'completed')
        .single();

      if (completedResult.data) {
        // Delete completed invitation and show message
        await supabase
          .from('invitations')
          .delete()
          .eq('email', email.toLowerCase())
          .eq('status', 'completed');

        return NextResponse.json(
          { error: 'Onboarding already completed! This email has already been registered.' },
          { status: 410 }
        );
      }

      // Find pending invitation by email
      const result = await supabase
        .from('invitations')
        .select(`
          *,
          organizations (name),
          departments (name)
        `)
        .eq('email', email.toLowerCase())
        .eq('status', 'pending')
        .single();
      
      invitation = result.data;
      invitationError = result.error;
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
      await supabase
        .from('invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id);

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
        organizationName: invitation.organizations?.name,
        departmentId: invitation.department_id,
        departmentName: invitation.departments?.name
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