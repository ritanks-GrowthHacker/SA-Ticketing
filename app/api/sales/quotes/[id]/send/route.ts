import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { supabaseAdminSales } from '@/app/db/connections';
import { DecodedToken, extractUserAndOrgId } from '../../../helpers';
import { emailService } from '@/lib/emailService';
import { emailTemplates } from '@/app/emailTemplates';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;
    const { userId, organizationId } = extractUserAndOrgId(decoded);
    const { id } = await params;

    // Generate magic link token
    const magicToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 15); // 15 days from now

    // Update quote with magic link and status
    const { data: quote, error: updateError } = await supabaseAdminSales
      .from('quotes')
      .update({
        magic_link_token: magicToken,
        magic_link_expires_at: expiresAt.toISOString(),
        status: 'sent'
      })
      .eq('quote_id', id)
      .eq('organization_id', organizationId)
      .select('*, clients(*)')
      .single();

    if (updateError) {
      console.error('Error updating quote:', updateError);
      return NextResponse.json({ error: 'Failed to update quote' }, { status: 500 });
    }

    // Generate magic link URL with token parameter
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const magicLink = `${baseUrl}/quote/preview?token=${magicToken}`;

    // Send email to client with magic link
    try {
      await emailService.sendEmail({
        to: quote.clients.email,
        subject: `Quote ${quote.quote_number} - ${quote.quote_title}`,
        html: emailTemplates.quoteSent({
          quoteNumber: quote.quote_number,
          quoteTitle: quote.quote_title,
          totalAmount: quote.total_amount,
          currency: quote.currency || 'INR',
          validUntil: quote.valid_until,
          clientName: quote.clients.client_name,
          contactPerson: quote.clients.contact_person,
          magicLink
        })
      });
      console.log('✅ Quote email sent to:', quote.clients.email);
    } catch (emailError) {
      console.error('❌ Error sending email:', emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      message: 'Quote sent successfully',
      magic_link: magicLink,
      quote
    });
  } catch (error) {
    console.error('Error in POST /api/sales/quotes/[id]/send:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
