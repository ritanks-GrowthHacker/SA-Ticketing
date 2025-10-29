// This file is deprecated. Use /api/send-email route or the emailService utility instead.
// Keeping for backward compatibility.

import { emailService } from "@/lib/emailService";

interface EmailRequestBody {
  to: string;
  subject?: string;
  text?: string;
  html?: string;
  projectName?: string;
  role?: string;
  assigneeName?: string;
}

/**
 * @deprecated Use emailService from @/lib/emailService instead
 * This function is kept for backward compatibility
 */
export const testEmail = async (to: string, subject?: string, text?: string): Promise<{ success: boolean; messageId?: string; error?: string }> => {
  return emailService.sendEmail({
    to,
    subject: subject || "Team Assignment",
    text: text || "Hi there, You have been assigned to Talent-Go Project as a UI/UX Designer",
  });
};

/**
 * Send team assignment email
 */
export const sendTeamAssignmentEmail = async (
  to: string, 
  projectName: string, 
  role: string, 
  assigneeName: string
): Promise<{ success: boolean; messageId?: string; error?: string }> => {
  return emailService.sendTeamAssignmentEmail(to, projectName, role, assigneeName);
};

/**
 * Send ticket notification email
 */
export const sendTicketNotification = async (
  to: string,
  ticketId: string,
  title: string,
  status: string,
  assigneeName: string
): Promise<{ success: boolean; messageId?: string; error?: string }> => {
  return emailService.sendTicketNotificationEmail(to, ticketId, title, status, assigneeName);
};
