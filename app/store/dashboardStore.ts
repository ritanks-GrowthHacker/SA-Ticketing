import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// Types for dashboard metrics
export interface MetricValue {
  value: number | string;
  change: string;
  changeType: 'positive' | 'negative' | 'neutral';
}

export interface ActivityItem {
  id: any;
  title: string;
  status: string;
  time: string;
  project?: string;
  priority: string;
  priorityColor?: string;
  assignedTo: string;
  creator?: {
    id: string;
    name: string;
    email: string;
  };
  assignee?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface ChartDataPoint {
  day: string;
  tickets: number;
}

export interface DashboardMetrics {
  overview: Record<string, MetricValue>;
  recentActivity: ActivityItem[];
  chartData: { weekly?: ChartDataPoint[] };
  quickStats: Record<string, any>;
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface CachedDashboardData {
  metrics: DashboardMetrics;
  projectId: string | null; // Track which project the data is for
  timestamp: number; // When the data was cached
  userRole: string;
  organizationId: string;
}

export interface DashboardState {
  // Cache data
  cachedData: CachedDashboardData | null;
  
  // Loading states
  isLoading: boolean;
  
  // Cross-tab synchronization
  lastUpdateTimestamp: number;
  
  // Cache management
  setCachedData: (data: DashboardMetrics, projectId: string | null, userRole: string, organizationId: string) => void;
  getCachedData: (projectId: string | null, organizationId: string) => DashboardMetrics | null;
  clearCache: () => void;
  isCacheValid: (projectId: string | null, organizationId: string, maxAgeMinutes?: number) => boolean;
  setLoading: (loading: boolean) => void;
  
  // Cross-tab sync methods
  invalidateCache: (reason?: string) => void;
  broadcastUpdate: (type: 'ticket_created' | 'ticket_updated' | 'status_changed', data?: any) => void;
  setupCrossTabSync: () => void;
}

// Cache expiry time (15 minutes by default)
const DEFAULT_CACHE_EXPIRY_MINUTES = 15;

// Create the Dashboard store with persistence
export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      // Initial state
      cachedData: null,
      isLoading: false,
      lastUpdateTimestamp: 0,

      // Actions
      setCachedData: (metrics, projectId, userRole, organizationId) => {
        const cachedData: CachedDashboardData = {
          metrics,
          projectId,
          timestamp: Date.now(),
          userRole,
          organizationId,
        };
        
        set({ cachedData });
      },

      getCachedData: (projectId, organizationId) => {
        const state = get();
        
        if (!state.cachedData) {
          return null;
        }

        // Check if cache is for the same project and organization
        const isSameProject = state.cachedData.projectId === projectId;
        const isSameOrg = state.cachedData.organizationId === organizationId;
        
        if (!isSameProject || !isSameOrg) {
          return null;
        }

        // Check if cache is still valid (not expired)
        if (!state.isCacheValid(projectId, organizationId)) {
          return null;
        }

        return state.cachedData.metrics;
      },

      clearCache: () => {
        set({ cachedData: null });
      },

      isCacheValid: (projectId, organizationId, maxAgeMinutes = DEFAULT_CACHE_EXPIRY_MINUTES) => {
        const state = get();
        
        if (!state.cachedData) {
          return false;
        }

        // Check if it's for the same project and organization
        const isSameProject = state.cachedData.projectId === projectId;
        const isSameOrg = state.cachedData.organizationId === organizationId;
        
        if (!isSameProject || !isSameOrg) {
          return false;
        }

        // Check if cache hasn't expired
        const now = Date.now();
        const cacheAge = now - state.cachedData.timestamp;
        const maxAge = maxAgeMinutes * 60 * 1000; // Convert to milliseconds
        
        return cacheAge < maxAge;
      },

      setLoading: (loading) => {
        set({ isLoading: loading });
      },

      // Cross-tab synchronization methods
      invalidateCache: (reason = 'manual') => {
        set({ cachedData: null, lastUpdateTimestamp: Date.now() });
        
        // Broadcast to other tabs
        if (typeof window !== 'undefined') {
          localStorage.setItem('dashboard_invalidate', JSON.stringify({
            timestamp: Date.now(),
            reason,
          }));
        }
      },

      broadcastUpdate: (type, data) => {
        const updateData = {
          type,
          data,
          timestamp: Date.now(),
        };
        
        if (typeof window !== 'undefined') {
          localStorage.setItem('dashboard_update', JSON.stringify(updateData));
          // Remove immediately to trigger event in other tabs
          localStorage.removeItem('dashboard_update');
        }
        
        // Update local timestamp
        set({ lastUpdateTimestamp: Date.now() });
      },

      setupCrossTabSync: () => {
        if (typeof window === 'undefined') return;
        
        const handleStorageChange = (e: StorageEvent) => {
          if (e.key === 'dashboard_invalidate' && e.newValue) {
            const invalidateData = JSON.parse(e.newValue);
            console.log('🔄 Cross-tab cache invalidation:', invalidateData.reason);
            set({ cachedData: null, lastUpdateTimestamp: invalidateData.timestamp });
          }
          
          if (e.key === 'dashboard_update' && e.newValue) {
            const updateData = JSON.parse(e.newValue);
            console.log('🔄 Cross-tab update received:', updateData.type);
            
            // Invalidate cache to force refresh
            set({ cachedData: null, lastUpdateTimestamp: updateData.timestamp });
          }
        };
        
        window.addEventListener('storage', handleStorageChange);
        
        // Return cleanup function
        return () => {
          window.removeEventListener('storage', handleStorageChange);
        };
      },
    }),
    {
      name: 'dashboard-storage', // unique name for localStorage key
      storage: createJSONStorage(() => localStorage),
      // Only persist the cached data and timestamp, not loading states
      partialize: (state) => ({ 
        cachedData: state.cachedData,
        lastUpdateTimestamp: state.lastUpdateTimestamp
      }),
    }
  )
);