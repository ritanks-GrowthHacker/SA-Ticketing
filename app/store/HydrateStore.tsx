'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from './authStore'

interface HydrateStoreProps {
  children: React.ReactNode
}

/**
 * This component ensures the Zustand store is properly hydrated
 * before rendering children components to prevent SSR mismatch
 */
export function HydrateStore({ children }: HydrateStoreProps) {
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    // Wait for the store to be hydrated from localStorage
    const unsubscribe = useAuthStore.persist.onFinishHydration(() => {
      setIsHydrated(true)
    })

    // If already hydrated, set state immediately
    if (useAuthStore.persist.hasHydrated()) {
      setIsHydrated(true)
    }

    return unsubscribe
  }, [])

  // Show loading or placeholder while hydrating
  if (!isHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return <>{children}</>
}