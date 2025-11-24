'use client';

import React, { useEffect } from 'react';
import { CheckCircle, XCircle, Info } from 'lucide-react';

interface SalesToastProps {
  type: 'success' | 'error' | 'info';
  message: string;
  show: boolean;
  onClose: () => void;
  duration?: number;
}

export function SalesToast({ type, message, show, onClose, duration = 4000 }: SalesToastProps) {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [show, duration, onClose]);

  if (!show) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5" />;
      case 'error':
        return <XCircle className="w-5 h-5" />;
      case 'info':
        return <Info className="w-5 h-5" />;
    }
  };

  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      case 'info':
        return 'bg-blue-500';
    }
  };

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg transition-all duration-300 ${getBackgroundColor()} text-white`}
    >
      <div className="flex items-center space-x-3">
        {getIcon()}
        <span className="font-medium">{message}</span>
        <button
          onClick={onClose}
          className="ml-2 text-white hover:text-gray-200"
        >
          ×
        </button>
      </div>
    </div>
  );
}
