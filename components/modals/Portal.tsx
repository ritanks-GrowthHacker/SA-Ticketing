'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface PortalProps {
  children: React.ReactNode;
  containerId?: string;
}

export default function Portal({ children, containerId = 'modal-root' }: PortalProps) {
  const [mounted, setMounted] = useState(false);
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // Create or get the portal container
    let portalContainer = document.getElementById(containerId);
    
    if (!portalContainer) {
      portalContainer = document.createElement('div');
      portalContainer.id = containerId;
      portalContainer.style.position = 'fixed';
      portalContainer.style.top = '0';
      portalContainer.style.left = '0';
      portalContainer.style.zIndex = '9999';
      portalContainer.style.pointerEvents = 'none'; // Allow clicks through when no modal
      document.body.appendChild(portalContainer);
    }

    // Enable pointer events when modal is present
    portalContainer.style.pointerEvents = 'auto';

    setContainer(portalContainer);
    setMounted(true);

    // Cleanup function
    return () => {
      if (portalContainer && portalContainer.parentNode) {
        // Check if this is the last modal
        if (portalContainer.children.length <= 1) {
          portalContainer.style.pointerEvents = 'none';
        }
      }
    };
  }, [containerId]);

  // Prevent rendering on server-side
  if (!mounted || !container) {
    return null;
  }

  return createPortal(children, container);
}