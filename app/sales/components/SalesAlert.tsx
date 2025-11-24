'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface SalesAlertProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'success' | 'error' | 'warning';
  title: string;
  message: string;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
}

export function SalesAlert({
  isOpen,
  onClose,
  type,
  title,
  message,
  onConfirm,
  confirmText = 'OK',
  cancelText = 'Cancel'
}: SalesAlertProps) {
  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />;
      case 'error':
        return <XCircle className="h-16 w-16 text-red-600 mx-auto mb-4" />;
      case 'warning':
        return <AlertCircle className="h-16 w-16 text-yellow-600 mx-auto mb-4" />;
    }
  };

  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-50';
      case 'error':
        return 'bg-red-50';
      case 'warning':
        return 'bg-yellow-50';
    }
  };

  const getTextColor = () => {
    switch (type) {
      case 'success':
        return 'text-green-900';
      case 'error':
        return 'text-red-900';
      case 'warning':
        return 'text-yellow-900';
    }
  };

  const getButtonColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-600 hover:bg-green-700';
      case 'error':
        return 'bg-red-600 hover:bg-red-700';
      case 'warning':
        return 'bg-yellow-600 hover:bg-yellow-700';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <div className={`${getBackgroundColor()} -mx-6 -mt-6 px-6 pt-6 pb-4`}>
          <div className="text-center">
            {getIcon()}
            <DialogHeader>
              <DialogTitle className={`text-2xl ${getTextColor()}`}>{title}</DialogTitle>
            </DialogHeader>
          </div>
        </div>
        <div className="py-4">
          <p className="text-center text-gray-700">{message}</p>
        </div>
        <div className="flex justify-center gap-3 pb-4">
          {onConfirm ? (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                {cancelText}
              </button>
              <button
                onClick={handleConfirm}
                className={`px-4 py-2 text-white rounded-lg ${getButtonColor()}`}
              >
                {confirmText}
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className={`px-4 py-2 text-white rounded-lg ${getButtonColor()} w-full`}
            >
              {confirmText}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
