'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/app/store/authStore';
import { Clock, LogIn, LogOut, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface AttendanceStatus {
  hasCheckedIn: boolean;
  hasCheckedOut: boolean;
  checkInTime?: string;
  checkOutTime?: string;
  workHours?: string;
}

export function AttendanceCheckInOut() {
  const { token } = useAuth();
  const [status, setStatus] = useState<AttendanceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetchAttendanceStatus();
  }, [token]);

  const fetchAttendanceStatus = async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      
      const response = await fetch(`/api/hrm/attendance/status?date=${today}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      } else {
        setStatus({ hasCheckedIn: false, hasCheckedOut: false });
      }
    } catch (err) {
      console.error('Failed to fetch attendance status:', err);
      setStatus({ hasCheckedIn: false, hasCheckedOut: false });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckInOut = async () => {
    if (!status || actionLoading) return;

    setActionLoading(true);

    try {
      const action = status.hasCheckedIn ? 'check-out' : 'check-in';

      const response = await fetch('/api/hrm/attendance/mark', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action })
      });

      const data = await response.json();

      if (response.ok) {
        if (action === 'check-in') {
          const time = new Date(data.attendance.checkInTime).toLocaleTimeString('en-IN', { 
            hour: '2-digit', 
            minute: '2-digit' 
          });
          toast.success(`✅ Checked in successfully at ${time}`);
        } else {
          const hours = data.attendance.workHours || '0';
          toast.success(`✅ Checked out successfully! Work hours: ${hours} hrs`);
        }
        await fetchAttendanceStatus();
      } else {
        toast.error(data.error || 'Failed to mark attendance');
      }
    } catch (err) {
      console.error('Check-in/out error:', err);
      toast.error('Network error. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg cursor-wait">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading...</span>
      </button>
    );
  }

  if (!status) return null;

  const getButtonConfig = () => {
    if (!status.hasCheckedIn) {
      return {
        text: 'Check In',
        icon: LogIn,
        color: 'bg-green-600 hover:bg-green-700 text-white',
        disabled: false
      };
    } else if (!status.hasCheckedOut) {
      return {
        text: 'Check Out',
        icon: LogOut,
        color: 'bg-blue-600 hover:bg-blue-700 text-white',
        disabled: false,
        subtitle: status.checkInTime ? `In: ${new Date(status.checkInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : ''
      };
    } else {
      return {
        text: 'Checked Out',
        icon: Clock,
        color: 'bg-gray-400 text-white cursor-not-allowed',
        disabled: true,
        subtitle: status.workHours ? `${status.workHours} hrs` : ''
      };
    }
  };

  const config = getButtonConfig();
  const Icon = config.icon;

  return (
    <button
      onClick={handleCheckInOut}
      disabled={config.disabled || actionLoading}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${config.color} disabled:opacity-50`}
      title={config.subtitle}
    >
      {actionLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Icon className="h-4 w-4" />
      )}
      <div className="flex flex-col items-start">
        <span className="text-sm font-medium">{config.text}</span>
        {config.subtitle && (
          <span className="text-xs opacity-90">{config.subtitle}</span>
        )}
      </div>
    </button>
  );
}
