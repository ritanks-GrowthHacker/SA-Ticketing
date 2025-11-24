import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdminSales, supabase } from '@/app/db/connections';
import { emailService } from '@/lib/emailService';

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
      
      const emailHTML = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #3b82f6;">Client Wants to Connect!</h2>
              <p>Hello ${salesPerson.full_name},</p>
              <p>Good news! A client has expressed interest in your quote and wants to discuss it further.</p>
              <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Quote Number:</strong> ${quote.quote_number}</p>
                <p style="margin: 5px 0;"><strong>Quote Title:</strong> ${quote.quote_title}</p>
                <p style="margin: 5px 0;"><strong>Amount:</strong> ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: quote.currency || 'INR' }).format(quote.total_amount)}</p>
              </div>
              <div style="background: #e0f2fe; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #0369a1;">Client Details:</h3>
                <p style="margin: 5px 0;"><strong>Name:</strong> ${quote.clients.client_name}</p>
                <p style="margin: 5px 0;"><strong>Contact Person:</strong> ${quote.clients.contact_person || 'N/A'}</p>
                <p style="margin: 5px 0;"><strong>Email:</strong> ${quote.clients.email}</p>
                <p style="margin: 5px 0;"><strong>Phone:</strong> ${quote.clients.phone || 'N/A'}</p>
              </div>
              <p><strong>Action Required:</strong> Please reach out to the client to discuss their requirements.</p>
              <p>The quote status has been updated to <strong>Hold</strong>.</p>
              <p style="color: #666; font-size: 12px; margin-top: 30px;">This is an automated notification from your Sales System.</p>
            </div>
          `;
      
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

    return NextResponse.json({
      message: 'Request sent successfully. The sales team will contact you soon.'
    });
  } catch (error) {
    console.error('Error in POST /api/sales/quotes/[id]/hold-public:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
