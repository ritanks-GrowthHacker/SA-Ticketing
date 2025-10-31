'use client';

import React from 'react';
import { Ticket } from 'lucide-react';

const CreateTicketPage = () => {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="text-center">
        <Ticket className="w-16 h-16 text-blue-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Create Ticket</h1>
        <p className="text-gray-600">Ticket creation functionality is now available in the dashboard.</p>
        <button 
          onClick={() => window.location.href = '/dashboard'}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
};

export default CreateTicketPage;