import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdminSales, supabase } from '@/app/db/connections';
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
    const { data: quote, error: quoteError } = await supabaseAdminSales
      .from('quotes')
      .select('*, clients(*)')
      .eq('quote_id', id)
      .eq('magic_link_token', token)
      .single();

    console.log('🔍 Quote fetched:', { 
      quote_id: quote?.quote_id, 
      created_by_user_id: quote?.created_by_user_id,
      status: quote?.status 
    });

    if (quoteError || !quote) {
      console.error('❌ Quote fetch error:', quoteError);
      return NextResponse.json({ error: 'Invalid quote or token' }, { status: 404 });
    }

    // Update quote status to hold
    await supabaseAdminSales
      .from('quotes')
      .update({
        status: 'hold',
        hold_at: new Date().toISOString()
      })
      .eq('quote_id', id);

    console.log('📧 Fetching sales person details for user_id:', quote.created_by_user_id);

    // Get sales person details from sales_team_hierarchy
    const { data: salesPerson, error: salesPersonError } = await supabaseAdminSales
      .from('sales_team_hierarchy')
      .select('full_name, email')
      .eq('user_id', quote.created_by_user_id)
      .single();

    console.log('👤 Sales person found:', salesPerson);
    if (salesPersonError) console.error('❌ Error fetching sales person:', salesPersonError);

    if (salesPerson && salesPerson.email) {
      console.log('📨 Sending connect email to:', salesPerson.email);
      
      const emailHTML = emailTemplates.clientConnectRequest({
        salesPersonName: salesPerson.full_name,
        quoteNumber: quote.quote_number,
        quoteTitle: quote.quote_title,
        totalAmount: quote.total_amount,
        currency: quote.currency || 'INR',
        clientName: quote.clients.client_name,
        contactPerson: quote.clients.contact_person,
        clientEmail: quote.clients.email,
        clientPhone: quote.clients.phone
      });
      
      console.log('📧 Email Content:', {
        to: salesPerson.email,
        subject: `Client Wants to Connect - Quote ${quote.quote_number}`,
        htmlPreview: emailHTML.substring(0, 200) + '...'
      });
      
      // Send email to sales person
      try {
        const emailResult = await emailService.sendEmail({
          to: salesPerson.email,
          subject: `Client Wants to Connect - Quote ${quote.quote_number}`,
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
      console.warn('⚠️ No sales person found or email missing for user_id:', quote.created_by_user_id);
    }

    // Send notification to sales member
    try {
      const { createSalesNotification } = await import('@/lib/salesNotifications');
      
      await createSalesNotification({
        userId: quote.created_by_user_id,
        organizationId: quote.organization_id,
        entityType: 'quote',
        entityId: quote.quote_id,
        title: '🤝 Client Wants to Connect',
        message: `${quote.clients.client_name} wants to discuss Quote ${quote.quote_number}. Please contact them soon.`,
        type: 'quote_sent',
        metadata: {
          quote_number: quote.quote_number,
          client_name: quote.clients.client_name,
          client_email: quote.clients.email,
          client_phone: quote.clients.phone,
          amount: quote.total_amount,
          currency: quote.currency || 'INR'
        }
      });
      console.log('✅ Hold notification sent to user:', quote.created_by_user_id);
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
