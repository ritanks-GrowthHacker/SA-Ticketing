import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { supabase } from '@/app/db/connections';
import { emailService } from '@/lib/emailService';

interface JWTPayload {
  sub: string;
  org_id: string;
  role: string;
}

interface MentionNotificationRequest {
  ticketId: string;
  commentId: string;
  mentionedUserIds: string[];
  commentText: string;
}

export async function POST(req: NextRequest) {
  try {
    // Get JWT token from authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authorization token is required" }, 
        { status: 401 }
      );
    }

    const token = authHeader.split(" ")[1];
    let decodedToken: JWTPayload;

    try {
      decodedToken = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    } catch (jwtError) {
      console.error("JWT verification error:", jwtError);
      return NextResponse.json(
        { error: "Invalid or expired token" }, 
        { status: 401 }
      );
    }

    const { ticketId, commentId, mentionedUserIds, commentText }: MentionNotificationRequest = await req.json();

    if (!ticketId || !commentId || !mentionedUserIds || mentionedUserIds.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields" }, 
        { status: 400 }
      );
    }

    console.log('🔔 Processing mention notifications:', { ticketId, commentId, mentionedUserIds });

    // Get ticket details
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select(`
        id,
        title,
        description,
        projects!inner(
          id,
          name
        )
      `)
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      console.error('Error fetching ticket:', ticketError);
      return NextResponse.json(
        { error: "Ticket not found" }, 
        { status: 404 }
      );
    }

    // Get commenter details
    const { data: commenter, error: commenterError } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('id', decodedToken.sub)
      .single();

    if (commenterError || !commenter) {
      console.error('Error fetching commenter:', commenterError);
      return NextResponse.json(
        { error: "Commenter not found" }, 
        { status: 404 }
      );
    }

    // Get mentioned users' details
    const { data: mentionedUsers, error: usersError } = await supabase
      .from('users')
      .select('id, name, email')
      .in('id', mentionedUserIds);

    if (usersError) {
      console.error('Error fetching mentioned users:', usersError);
      return NextResponse.json(
        { error: "Failed to fetch mentioned users" }, 
        { status: 500 }
      );
    }

    // Send emails to mentioned users
    const emailPromises = mentionedUsers.map(async (user) => {
      try {
        const emailSubject = `You were mentioned in a comment on "${ticket.title}"`;
        const emailBody = `
          <h2>You were mentioned in a comment</h2>
          <p><strong>${commenter.name}</strong> mentioned you in a comment on the ticket "<strong>${ticket.title}</strong>" in project "<strong>${(ticket.projects as any).name}</strong>".</p>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3>Comment:</h3>
            <p>${commentText.replace(/@\[([^\]]+)\]\([^)]+\)/g, '<strong>@$1</strong>')}</p>
          </div>
          
          <p><a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/tickets/${ticketId}" style="background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Ticket</a></p>
          
          <hr style="margin: 30px 0;">
          <p style="color: #6b7280; font-size: 12px;">
            This email was sent because you were mentioned in a comment. 
            You can manage your notification preferences in your account settings.
          </p>
        `;

        console.log(`📧 Sending mention notification to ${user.email}`);
        
        await emailService.sendEmail({
          to: user.email,
          subject: emailSubject,
          html: emailBody
        });

        return { userId: user.id, email: user.email, success: true };
      } catch (emailError) {
        console.error(`Failed to send email to ${user.email}:`, emailError);
        return { userId: user.id, email: user.email, success: false, error: emailError };
      }
    });

    const emailResults = await Promise.allSettled(emailPromises);
    
    // Log results
    const successCount = emailResults.filter(result => 
      result.status === 'fulfilled' && result.value.success
    ).length;
    
    console.log(`✅ Sent ${successCount}/${mentionedUserIds.length} mention notification emails`);

    // Store notification records in database
    try {
      const notifications = mentionedUsers.map(user => ({
        user_id: user.id,
        entity_type: 'ticket',
        entity_id: ticketId,
        type: 'info',
        title: `You were mentioned in a comment`,
        message: `${commenter.name} mentioned you in a comment on "${ticket.title}"`,
        is_read: false
      }));

      const { error: notificationError } = await supabase
        .from('notifications')
        .insert(notifications);
      
      if (notificationError) {
        console.error('Error storing notifications:', notificationError);
      } else {
        console.log(`✅ Created ${notifications.length} in-app notifications for mentions`);
      }
    } catch (notificationError) {
      console.error('Error storing notification records:', notificationError);
      // Non-critical error, don't fail the request
    }

    return NextResponse.json({
      message: "Mention notifications sent successfully",
      results: {
        totalMentions: mentionedUserIds.length,
        emailsSent: successCount,
        emailResults: emailResults.map(result => 
          result.status === 'fulfilled' ? result.value : { success: false, error: result.reason }
        )
      }
    });

  } catch (error) {
    console.error('Error sending mention notifications:', error);
    return NextResponse.json(
      { error: "Internal server error" }, 
      { status: 500 }
    );
  }
}