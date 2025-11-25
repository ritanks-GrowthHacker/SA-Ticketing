import { NextRequest } from 'next/server';
import { supabase } from '@/app/db/connections';
import jwt from 'jsonwebtoken';

// SSE endpoint for real-time ticket updates
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const projectId = searchParams.get('project_id');

  if (!token) {
    return new Response('Unauthorized - No token provided', { status: 401 });
  }

  try {
    // Verify token
    let decoded: any;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch (error) {
      console.error('SSE Token verification failed:', error);
      return new Response('Unauthorized - Invalid token', { status: 401 });
    }
    
    const userId = decoded.sub;
    const orgId = decoded.org_id;

    // Set up SSE headers
    const encoder = new TextEncoder();
    let lastCheckTime = new Date();
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send initial connection message
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'connected', message: 'Ticket updates stream connected' })}\n\n`)
          );

          // Keep-alive interval
          const keepAlive = setInterval(() => {
            try {
              controller.enqueue(encoder.encode(': keep-alive\n\n'));
            } catch (e) {
              clearInterval(keepAlive);
            }
          }, 30000); // Send keep-alive every 30 seconds

          // Poll for ticket updates every 2 seconds
          const pollInterval = setInterval(async () => {
            try {
              // Build query based on filters
              let query = supabase
                .from('tickets')
                .select(`
                  id,
                  title,
                  description,
                  status_id,
                  priority_id,
                  assigned_to,
                  created_by,
                  project_id,
                  updated_at,
                  created_at,
                  projects!inner(name, organization_id),
                  status:statuses!tickets_status_id_fkey(id, name, color_code),
                  priority:priorities!tickets_priority_id_fkey(id, name, color_code),
                  assignee:users!tickets_assigned_to_fkey(id, name, email),
                  creator:users!tickets_created_by_fkey(id, name, email)
                `)
                .eq('projects.organization_id', orgId)
                .gt('updated_at', lastCheckTime.toISOString())
                .order('updated_at', { ascending: false });

              // Filter by project if specified
              if (projectId) {
                query = query.eq('project_id', projectId);
              }

              const { data: updatedTickets, error } = await query;

              if (!error && updatedTickets && updatedTickets.length > 0) {
                // Send each updated ticket
                for (const ticket of updatedTickets) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({
                      type: 'ticket_update',
                      ticket: ticket
                    })}\n\n`)
                  );
                }
                
                // Update last check time to prevent sending duplicates
                lastCheckTime = new Date();
              }
            } catch (error) {
              console.error('Error polling ticket updates:', error);
            }
          }, 5000); // Poll every 5 seconds

          // Cleanup on close
          request.signal.addEventListener('abort', () => {
            clearInterval(keepAlive);
            clearInterval(pollInterval);
            try {
              controller.close();
            } catch (e) {
              // Already closed
            }
          });
        } catch (error) {
          console.error('SSE stream start error:', error);
          try {
            controller.close();
          } catch (e) {
            // Already closed
          }
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('SSE connection error:', error);
    return new Response('Unauthorized', { status: 401 });
  }
}
