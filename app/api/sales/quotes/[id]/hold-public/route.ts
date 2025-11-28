import { NextRequest, NextResponse } from 'next/server';
import { salesDb, salesTeamHierarchy, quotes, clients, eq, and } from '@/lib/sales-db-helper';
import { emailService } from '@/lib/emailService';
import { emailTemplates } from '@/app/emailTemplates';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { token } = await request.json();

    // Verify magic link token
    const quoteResult = await salesDb
      .select()
      .from(quotes)
      .where(
        and(
          eq(quotes.quoteId, id),
          eq(quotes.magicLinkToken, token)
        )
      )
      .limit(1);

    const quote = quoteResult[0];
    console.log('🔍 Quote fetched:', { 
      quote_id: quote?.quoteId, 
      created_by_user_id: quote?.createdByUserId,
      status: quote?.status 
    });

    if (!quote) {
      console.error('❌ Quote not found');
      return NextResponse.json({ error: 'Invalid quote or token' }, { status: 404 });
    }

    // Fetch client info
    const clientResult = await salesDb
      .select()
      .from(clients)
      .where(eq(clients.clientId, quote.clientId))
      .limit(1);
    
    const client = clientResult[0];

    // Update quote status to hold
    await salesDb
      .update(quotes)
      .set({
        status: 'hold'
      })
      .where(eq(quotes.quoteId, id));

    console.log('📧 Fetching sales person details for user_id:', quote.createdByUserId);

    // Get sales person details from sales_team_hierarchy
    const salesPersonResult = await salesDb
      .select({ fullName: salesTeamHierarchy.fullName, email: salesTeamHierarchy.email })
      .from(salesTeamHierarchy)
      .where(eq(salesTeamHierarchy.userId, quote.createdByUserId))
      .limit(1);

    const salesPerson = salesPersonResult[0];
    console.log('👤 Sales person found:', salesPerson);

    if (salesPerson && salesPerson.email) {
      console.log('📨 Sending connect email to:', salesPerson.email);
      
      const emailHTML = emailTemplates.clientConnectRequest({
        salesPersonName: salesPerson.fullName,
        quoteNumber: quote.quoteNumber,
        quoteTitle: quote.quoteTitle,
        totalAmount: parseFloat(quote.totalAmount),
        currency: quote.currency || 'INR',
        clientName: client.clientName,
        contactPerson: client.contactPerson || '',
        clientEmail: client.email || '',
        clientPhone: client.phone || ''
      });
      
      console.log('📧 Email Content:', {
        to: salesPerson.email,
        subject: `Client Wants to Connect - Quote ${quote.quoteNumber}`,
        htmlPreview: emailHTML.substring(0, 200) + '...'
      });
      
      // Send email to sales person
      try {
        const emailResult = await emailService.sendEmail({
          to: salesPerson.email,
          subject: `Client Wants to Connect - Quote ${quote.quoteNumber}`,
          html: emailHTML
        });
        
        if (emailResult.success) {
          console.log('✅ Connect email sent successfully! MessageId:', emailResult.messageId);
        } else {
          console.error('❌ Email send failed:', emailResult.error);
        }
      } catch (emailError) {
        console.error('❌ Error sending connect email:', emailError);
        // Don't fail the request if email fails
      }
    } else {
      console.warn('⚠️ No sales person found or email missing for user_id:', quote.createdByUserId);
    }

    // Send notification to sales member
    try {
      const { createSalesNotification } = await import('@/lib/salesNotifications');
      
      await createSalesNotification({
        userId: quote.createdByUserId,
        organizationId: quote.organizationId,
        entityType: 'quote',
        entityId: quote.quoteId,
        title: '🤝 Client Wants to Connect',
        message: `${client.clientName} wants to discuss Quote ${quote.quoteNumber}. Please contact them soon.`,
        type: 'quote_sent',
        metadata: {
          quote_number: quote.quoteNumber,
          client_name: client.clientName,
          client_email: client.email,
          client_phone: client.phone,
          amount: quote.totalAmount,
          currency: quote.currency || 'INR'
        }
      });
      console.log('✅ Hold notification sent to user:', quote.createdByUserId);
    } catch (notifError) {
      console.error('❌ Error sending hold notification:', notifError);
    }

    return NextResponse.json({
      message: 'Request sent successfully. The sales team will contact you soon.'
    });
  } catch (error) {
    console.error('Error in POST /api/sales/quotes/[id]/hold-public:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
