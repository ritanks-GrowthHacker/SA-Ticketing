import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Organization {
  id: string;
  name: string;
  domain?: string;
  username?: string;
  org_email: string;
  mobile_number?: string;
  otp_verified: boolean;
  mobile_verified?: boolean;
  is_active?: boolean;
  created_at: string;
  updated_at?: string;
  onboarded_at?: string;
  associated_departments?: string[];
  has_departments?: boolean;
}

interface OrganizationStore {
  currentOrg: Organization | null;
  organizations: Organization[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setCurrentOrg: (org: Organization) => void;
  setCurrentOrgById: (orgId: string, orgData?: Partial<Organization>) => void;
  clearCurrentOrg: () => void;
  setOrganizations: (orgs: Organization[]) => void;
  fetchOrganizations: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  getCurrentOrgId: () => string | null;
  updateCurrentOrgSetup: (setupCompleted: boolean, departments?: string[]) => void;
}

export const useOrganizationStore = create<OrganizationStore>()(
  persist(
    (set, get) => ({
      currentOrg: null,
      organizations: [],
      isLoading: false,
      error: null,

      setCurrentOrg: (org: Organization) => {
        set({ currentOrg: org, error: null });
      },

      setCurrentOrgById: (orgId: string, orgData?: Partial<Organization>) => {
        if (orgData) {
          set({ currentOrg: { ...orgData, id: orgId } as Organization, error: null });
        } else {
          // If no orgData provided, create minimal org object
          set({ currentOrg: { id: orgId } as Organization, error: null });
        }
      },

      clearCurrentOrg: () => {
        set({ currentOrg: null });
      },

      setOrganizations: (orgs: Organization[]) => {
        set({ organizations: orgs });
      },

      fetchOrganizations: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch('/api/get-all-organizations');
          const data = await response.json();
          
          if (data.success) {
            set({ organizations: data.organizations, isLoading: false });
          } else {
            set({ error: 'Failed to load organizations', isLoading: false });
          }
        } catch (error) {
          set({ error: 'Error loading organizations', isLoading: false });
        }
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      setError: (error: string | null) => {
        set({ error });
      },

      getCurrentOrgId: () => {
        const { currentOrg } = get();
        return currentOrg?.id || null;
      },

      updateCurrentOrgSetup: (setupCompleted: boolean, departments?: string[]) => {
        const { currentOrg } = get();
        if (currentOrg) {
          set({
            currentOrg: {
              ...currentOrg,
              associated_departments: departments || currentOrg.associated_departments,
              updated_at: new Date().toISOString()
            }
          });
        }
      }
    }),
    {
      name: 'organization-store', // unique name for localStorage
      partialize: (state) => ({ 
        currentOrg: state.currentOrg,
        organizations: state.organizations 
      }), // only persist these fields
    }
  )
);