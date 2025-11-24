'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/app/store/authStore';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function SalesPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      console.log('❌ Sales page: No token, redirecting to login');
      router.push('/user-login');
      return;
    }

    // Check if user is from Sales department and redirect
    const checkSalesAuth = async () => {
      console.log('🔍 Sales page: Starting auth check...');
      setIsChecking(true);
      setError(null);

      try {
        const response = await fetch('/api/sales/auth-check', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        const data = await response.json();
        console.log('📦 Sales page: Auth check response:', data);

        if (!response.ok) {
          console.error('❌ Sales page: Auth check failed:', data);
          setError(data.message || 'Authentication failed');
          setTimeout(() => router.push('/dashboard'), 2000);
          return;
        }

        if (data.isSalesUser) {
          console.log('✅ Sales page: User has Sales access, redirecting to:', data.redirectTo);
          router.push(data.redirectTo);
        } else {
          console.log('ℹ️ Sales page: User does not have Sales access:', data.message);
          setError(data.message || 'You do not have access to Sales module');
          setTimeout(() => router.push('/dashboard'), 2000);
        }
      } catch (error) {
        console.error('❌ Sales page: Error during auth check:', error);
        setError('Failed to verify access');
        setTimeout(() => router.push('/dashboard'), 2000);
      } finally {
        setIsChecking(false);
      }
    };

    checkSalesAuth();
  }, [token, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        {isChecking ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
            <div className="text-lg">Checking Sales access...</div>
          </>
        ) : error ? (
          <>
            <div className="text-lg text-red-600 mb-2">{error}</div>
            <div className="text-sm text-gray-500">Redirecting to dashboard...</div>
          </>
        ) : (
          <div className="text-lg">Redirecting to your Sales dashboard...</div>
        )}
      </div>
    </div>
  );
}
