import { NextRequest } from 'next/server';
// import { supabase } from '@/app/db/connections';
import { db, sql } from '@/lib/db-helper';
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
              // Build SQL query based on filters
              let querySQL;
              if (projectId) {
                querySQL = sql`
                  SELECT 
                    t.id, t.title, t.description, t.status_id, t.priority_id,
                    t.assigned_to, t.created_by, t.project_id, t.updated_at, t.created_at,
                    p.name as project_name, p.organization_id,
                    s.id as status_id_val, s.name as status_name, s.color_code as status_color,
                    pr.id as priority_id_val, pr.name as priority_name, pr.color_code as priority_color,
                    assignee.id as assignee_id, assignee.name as assignee_name, assignee.email as assignee_email,
                    creator.id as creator_id, creator.name as creator_name, creator.email as creator_email
                  FROM tickets t
                  INNER JOIN projects p ON t.project_id = p.id
                  LEFT JOIN statuses s ON t.status_id = s.id
                  LEFT JOIN statuses pr ON t.priority_id = pr.id
                  LEFT JOIN users assignee ON t.assigned_to = assignee.id
                  LEFT JOIN users creator ON t.created_by = creator.id
                  WHERE p.organization_id = ${orgId}
                  AND t.updated_at > ${lastCheckTime.toISOString()}
                  AND t.project_id = ${projectId}
                  ORDER BY t.updated_at DESC
                `;
              } else {
                querySQL = sql`
                  SELECT 
                    t.id, t.title, t.description, t.status_id, t.priority_id,
                    t.assigned_to, t.created_by, t.project_id, t.updated_at, t.created_at,
                    p.name as project_name, p.organization_id,
                    s.id as status_id_val, s.name as status_name, s.color_code as status_color,
                    pr.id as priority_id_val, pr.name as priority_name, pr.color_code as priority_color,
                    assignee.id as assignee_id, assignee.name as assignee_name, assignee.email as assignee_email,
                    creator.id as creator_id, creator.name as creator_name, creator.email as creator_email
                  FROM tickets t
                  INNER JOIN projects p ON t.project_id = p.id
                  LEFT JOIN statuses s ON t.status_id = s.id
                  LEFT JOIN statuses pr ON t.priority_id = pr.id
                  LEFT JOIN users assignee ON t.assigned_to = assignee.id
                  LEFT JOIN users creator ON t.created_by = creator.id
                  WHERE p.organization_id = ${orgId}
                  AND t.updated_at > ${lastCheckTime.toISOString()}
                  ORDER BY t.updated_at DESC
                `;
              }

              const result = await db.execute<any>(querySQL);
              const updatedTickets = result.rows;

              if (updatedTickets && updatedTickets.length > 0) {
                // Send each updated ticket
                for (const ticket of updatedTickets) {
                  // Map to expected format
                  const formattedTicket = {
                    id: ticket.id,
                    title: ticket.title,
                    description: ticket.description,
                    status_id: ticket.status_id,
                    priority_id: ticket.priority_id,
                    assigned_to: ticket.assigned_to,
                    created_by: ticket.created_by,
                    project_id: ticket.project_id,
                    updated_at: ticket.updated_at,
                    created_at: ticket.created_at,
                    projects: { name: ticket.project_name, organization_id: ticket.organization_id },
                    status: { id: ticket.status_id_val, name: ticket.status_name, color_code: ticket.status_color },
                    priority: { id: ticket.priority_id_val, name: ticket.priority_name, color_code: ticket.priority_color },
                    assignee: { id: ticket.assignee_id, name: ticket.assignee_name, email: ticket.assignee_email },
                    creator: { id: ticket.creator_id, name: ticket.creator_name, email: ticket.creator_email }
                  };
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({
                      type: 'ticket_update',
                      ticket: formattedTicket
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
