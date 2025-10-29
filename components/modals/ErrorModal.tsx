'use client';

import { AlertTriangle, X } from 'lucide-react';
import BaseModal from './BaseModal';

interface ErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  details?: string;
}

export default function ErrorModal({ 
  isOpen, 
  onClose, 
  title = "Error", 
  message, 
  details 
}: ErrorModalProps) {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      showCloseButton={false}
      closeOnOverlayClick={true}
      closeOnEscape={true}
    >
      <div className="p-6">
        <div className="flex items-start space-x-4">
          <div className="shrink-0">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {title}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {message}
            </p>
            {details && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
                <p className="text-sm text-red-700 font-mono">{details}</p>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </BaseModal>
  );
}