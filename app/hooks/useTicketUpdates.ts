'use client';

import { useEffect, useCallback } from 'react';

interface UseTicketUpdatesOptions {
  onUpdate?: (ticket: any) => void;
  projectId?: string;
}

export function useTicketUpdates(options: UseTicketUpdatesOptions = {}) {
  const { onUpdate, projectId } = options;

  const handleTicketUpdate = useCallback((event: Event) => {
    const customEvent = event as CustomEvent;
    const updatedTicket = customEvent.detail;
    
    // Filter by project if specified
    if (projectId && updatedTicket.project_id !== projectId) {
      return;
    }

    console.log('🎫 Handling ticket update:', updatedTicket);
    onUpdate?.(updatedTicket);
  }, [onUpdate, projectId]);

  useEffect(() => {
    // Listen for ticket updates via custom event
    window.addEventListener('ticket-updated', handleTicketUpdate);

    return () => {
      window.removeEventListener('ticket-updated', handleTicketUpdate);
    };
  }, [handleTicketUpdate]);
}
