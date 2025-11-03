// Example: How to integrate TicketComments into your TicketModal
// File: components/modals/TicketModal.tsx (addition)

import React, { useState } from 'react';
import TicketComments from '../comments/TicketComments';

// Add this to your existing TicketModal component, perhaps as a tab or section:

interface TicketModalProps {
  ticketId: string;
  isOpen: boolean;
  onClose: () => void;
}

const TicketModalWithComments: React.FC<TicketModalProps> = ({ ticketId, isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'details' | 'comments'>('details');
  
  return (
    <div className="modal-container">
      {/* Modal Header */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('details')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'details'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Details
          </button>
          <button
            onClick={() => setActiveTab('comments')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'comments'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Comments
          </button>
        </nav>
      </div>

      {/* Modal Content */}
      <div className="modal-body">
        {activeTab === 'details' ? (
          <div>
            {/* Your existing ticket details content */}
          </div>
        ) : (
          <div className="p-6">
            <TicketComments 
              ticketId={ticketId} 
              onCommentAdded={() => {
                // Optional: refresh ticket data or show notification
                console.log('New comment added!');
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

// OR: Add as a separate section in the existing modal:

const TicketModalWithCommentsSection: React.FC<TicketModalProps> = ({ ticketId, isOpen, onClose }) => {
  return (
    <div className="modal-container">
      {/* Existing ticket content */}
      <div className="ticket-details">
        {/* Your existing ticket form/details */}
      </div>

      {/* Comments Section */}
      <div className="border-t border-gray-200 mt-6 pt-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Comments</h3>
        <TicketComments 
          ticketId={ticketId} 
          onCommentAdded={() => {
            // Optional callback when comments are added
          }}
        />
      </div>
    </div>
  );
};

export { TicketModalWithComments, TicketModalWithCommentsSection };