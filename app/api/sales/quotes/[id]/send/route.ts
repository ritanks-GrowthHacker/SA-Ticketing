import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { salesDb, quotes, clients, eq, and } from '@/lib/sales-db-helper';
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
    const quoteResult = await salesDb
      .update(quotes)
      .set({
        magicLinkToken: magicToken,
        magicLinkExpiresAt: expiresAt,
        status: 'sent'
      })
      .where(
        and(
          eq(quotes.quoteId, id),
          eq(quotes.organizationId, organizationId)
        )
      )
      .returning();

    const quote = quoteResult[0];
    if (!quote) {
      console.error('Error updating quote: not found');
      return NextResponse.json({ error: 'Failed to update quote' }, { status: 500 });
    }

    // Fetch client info
    const clientResult = await salesDb
      .select()
      .from(clients)
      .where(eq(clients.clientId, quote.clientId))
      .limit(1);
    
    const client = clientResult[0];

    // Generate magic link URL with token parameter
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const magicLink = `${baseUrl}/quote/preview?token=${magicToken}`;

    // Send email to client with magic link
    try {
      await emailService.sendEmail({
        to: client.email!,
        subject: `Quote ${quote.quoteNumber} - ${quote.quoteTitle}`,
        html: emailTemplates.quoteSent({
          quoteNumber: quote.quoteNumber,
          quoteTitle: quote.quoteTitle,
          totalAmount: parseFloat(quote.totalAmount),
          currency: quote.currency || 'INR',
          validUntil: quote.validUntil?.toISOString(),
          clientName: client.clientName,
          contactPerson: client.contactPerson || '',
          magicLink
        })
      });
      console.log('✅ Quote email sent to:', client.email);
    } catch (emailError) {
      console.error('❌ Error sending email:', emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      message: 'Quote sent successfully',
      magic_link: magicLink,
      quote: { ...quote, clients: client }
    });
  } catch (error) {
    console.error('Error in POST /api/sales/quotes/[id]/send:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
