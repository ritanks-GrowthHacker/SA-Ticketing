'use client';

import { useLoading } from '../providers/LoadingProvider';
import { useCallback } from 'react';

export function useApiCall() {
  const { showLoading, hideLoading } = useLoading();

  const apiCall = useCallback(
    async <T = any>(
      url: string,
      options?: RequestInit & { showLoader?: boolean }
    ): Promise<Response> => {
      const { showLoader = true, ...fetchOptions } = options || {};

      try {
        if (showLoader) {
          showLoading();
        }

        const response = await fetch(url, fetchOptions);
        return response;
      } finally {
        if (showLoader) {
          // Small delay to prevent flashing for very fast requests
          setTimeout(() => {
            hideLoading();
          }, 300);
        }
      }
    },
    [showLoading, hideLoading]
  );

  return { apiCall };
}
