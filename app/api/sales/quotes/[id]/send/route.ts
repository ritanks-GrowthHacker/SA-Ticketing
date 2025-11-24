import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { supabaseAdminSales } from '@/app/db/connections';
import { DecodedToken, extractUserAndOrgId } from '../../../helpers';
import { emailService } from '@/lib/emailService';

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
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">New Quote from Your Sales Team</h2>
            <p>Hello ${quote.clients.contact_person || quote.clients.client_name},</p>
            <p>We have prepared a quote for you:</p>
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Quote Number:</strong> ${quote.quote_number}</p>
              <p style="margin: 5px 0;"><strong>Title:</strong> ${quote.quote_title}</p>
              <p style="margin: 5px 0;"><strong>Amount:</strong> ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: quote.currency || 'INR' }).format(quote.total_amount)}</p>
              <p style="margin: 5px 0;"><strong>Valid Until:</strong> ${quote.valid_until ? new Date(quote.valid_until).toLocaleDateString() : 'N/A'}</p>
            </div>
            <p>Click the button below to view and review your quote:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${magicLink}" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                View Quote
              </a>
            </div>
            <p style="color: #666; font-size: 12px;">This link will expire in 15 days.</p>
            <p style="color: #666; font-size: 12px;">If you have any questions, please don't hesitate to contact us.</p>
          </div>
        `
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
