import { NextRequest, NextResponse } from "next/server";
import { emailService } from "@/lib/emailService";

interface TestEmailBody {
  to: string;
  type?: 'simple' | 'team-assignment' | 'ticket-notification';
  projectName?: string;
  role?: string;
  assigneeName?: string;
  ticketId?: string;
  ticketTitle?: string;
  ticketStatus?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body: TestEmailBody = await req.json();
    const { 
      to, 
      type = 'simple',
      projectName = 'Test Project',
      role = 'Developer',
      assigneeName = 'Test User',
      ticketId = 'TCK-001',
      ticketTitle = 'Test Ticket',
      ticketStatus = 'Open'
    } = body;

    if (!to) {
      return NextResponse.json(
        { error: "Missing 'to' field (receiver email)" },
        { status: 400 }
      );
    }

    let result;

    switch (type) {
      case 'team-assignment':
        result = await emailService.sendTeamAssignmentEmail(to, projectName, role, assigneeName);
        break;
      case 'ticket-notification':
        result = await emailService.sendTicketNotificationEmail(to, ticketId, ticketTitle, ticketStatus, assigneeName);
        break;
      default:
        result = await emailService.sendEmail({
          to,
          subject: 'Test Email from Ticketing Metrix',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #2563eb;">Test Email</h2>
              <p>This is a test email from your Ticketing Metrix system.</p>
              <p>If you received this email, your email configuration is working correctly!</p>
              <p>Best regards,<br>Ticketing Metrix Team</p>
            </div>
          `,
          text: 'This is a test email from your Ticketing Metrix system. If you received this, your email configuration is working correctly!'
        });
    }

    if (result.success) {
      return NextResponse.json({
        success: true,
        messageId: result.messageId,
        message: `Test email sent successfully to ${to}`
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in test email endpoint:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

export async function GET(): Promise<NextResponse> {
  try {
    const isConnected = await emailService.verifyConnection();
    
    if (isConnected) {
      return NextResponse.json({
        success: true,
        message: "Email service is configured and connected successfully"
      });
    } else {
      return NextResponse.json(
        { success: false, error: "Email service connection failed" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error verifying email connection:", error);
    const errorMessage = error instanceof Error ? error.message : 'Email service verification failed';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}