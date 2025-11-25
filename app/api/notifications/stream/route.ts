import { NextRequest } from 'next/server';
import { supabase } from '@/app/db/connections';
import jwt from 'jsonwebtoken';

// SSE endpoint for real-time notifications
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

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

    // Set up SSE headers
    const encoder = new TextEncoder();
    let lastCheckTime = new Date();
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send initial connection message
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'connected', message: 'SSE connection established' })}\n\n`)
          );

          // Keep-alive interval
          const keepAlive = setInterval(() => {
            try {
              controller.enqueue(encoder.encode(': keep-alive\n\n'));
            } catch (e) {
              clearInterval(keepAlive);
            }
          }, 30000); // Send keep-alive every 30 seconds

          // Poll for new notifications every 3 seconds
          const pollInterval = setInterval(async () => {
            try {
              const { data: newNotifications, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', userId)
                .eq('is_read', false)
                .gt('created_at', lastCheckTime.toISOString())
                .order('created_at', { ascending: false });

              if (!error && newNotifications && newNotifications.length > 0) {
                // Send each new notification
                for (const notification of newNotifications) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify(notification)}\n\n`)
                  );
                }
                
                // Update last check time to prevent sending duplicates
                lastCheckTime = new Date();
              }
            } catch (error) {
              console.error('Error polling notifications:', error);
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
