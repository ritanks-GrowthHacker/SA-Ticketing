'use client';

import React from 'react';
import { CheckCircle } from 'lucide-react';
import BaseModal from './BaseModal';

interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  details?: string;
  autoClose?: boolean;
  autoCloseDelay?: number;
}

export default function SuccessModal({ 
  isOpen, 
  onClose, 
  title = "Success", 
  message, 
  details,
  autoClose = true,
  autoCloseDelay = 3000
}: SuccessModalProps) {
  
  // Auto close functionality
  React.useEffect(() => {
    if (isOpen && autoClose) {
      const timer = setTimeout(() => {
        onClose();
      }, autoCloseDelay);
      
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoClose, autoCloseDelay, onClose]);

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
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
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
              <div className="bg-green-50 border border-green-200 rounded-md p-3 mb-4">
                <p className="text-sm text-green-700">{details}</p>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
          >
            {autoClose ? 'Close' : 'OK'}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}