# Zustand Store Documentation

This project uses [Zustand](https://github.com/pmndrs/zustand) with persistence for state management.

## 📁 Store Structure

```
app/store/
├── authStore.ts      # Main Zustand store with authentication and org data
├── apiClient.ts      # API utility functions integrated with store
└── HydrateStore.tsx  # HOC to handle SSR hydration
```

## 🚀 Quick Start

### 1. Wrap your app with HydrateStore (in layout.tsx)

```tsx
import { HydrateStore } from './store/HydrateStore'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <HydrateStore>
          {children}
        </HydrateStore>
      </body>
    </html>
  )
}
```

### 2. Use the store in your components

```tsx
import { useAuth, useOrgData, useAuthActions } from './store/authStore'
import { useApiClient } from './store/apiClient'

function MyComponent() {
  const { isAuthenticated, user, organization, isAdmin } = useAuth()
  const { statuses, roles, departments } = useOrgData()
  const { logout } = useAuthActions()
  const { login, fetchOrgData } = useApiClient()

  // Your component logic here
}
```

## 🔑 Authentication

### Login
```tsx
const { login } = useApiClient()

const handleLogin = async () => {
  try {
    await login('user@example.com', 'password123')
    // User is automatically logged in and data persisted
  } catch (error) {
    console.error('Login failed:', error)
  }
}
```

### Logout
```tsx
const { logout } = useAuthActions()

const handleLogout = () => {
  logout() // Clears all data and removes from localStorage
}
```

### Check Authentication Status
```tsx
const { isAuthenticated, user, isAdmin } = useAuth()

if (!isAuthenticated) {
  return <LoginForm />
}

if (isAdmin()) {
  return <AdminPanel />
}
```

## 📊 Organization Data

### Fetch Organization Data
```tsx
const { fetchOrgData } = useApiClient()

useEffect(() => {
  if (isAuthenticated) {
    fetchOrgData() // Fetches statuses, roles, and departments
  }
}, [isAuthenticated])
```

### Access Organization Data
```tsx
const { 
  statuses, 
  roles, 
  departments, 
  getTicketStatuses, 
  getPriorityStatuses 
} = useOrgData()

// Get filtered data
const ticketStatuses = getTicketStatuses()
const priorityLevels = getPriorityStatuses()
```

### Create New Entities (Admin Only)
```tsx
const { createStatus, createRole, createDepartment } = useApiClient()

// Create new status
await createStatus({
  name: 'Blocked',
  type: 'ticket',
  color_code: '#EF4444',
  sort_order: 6
})

// Create new role
await createRole({
  name: 'Team Lead',
  description: 'Leads a team'
})

// Create new department
await createDepartment({
  name: 'Marketing'
})
```

## 🔧 Store Features

### ✅ Persistence
- All authentication data is automatically saved to `localStorage`
- Data persists across browser sessions
- Handles SSR hydration properly

### ✅ Type Safety
- Full TypeScript support
- Strongly typed store state and actions
- IntelliSense support in VS Code

### ✅ Selective Hooks
- `useAuth()` - Authentication-related data
- `useOrgData()` - Organization data (statuses, roles, departments)
- `useAuthActions()` - Actions for modifying store state

### ✅ Loading States
- `isLoading` - General loading state
- `isLoadingOrgData` - Specific to organization data loading

### ✅ Automatic API Integration
- API calls automatically update the store
- Error handling with automatic logout on 401
- Token management in API headers

## 📝 Store State Structure

```typescript
interface AuthState {
  // Authentication
  isAuthenticated: boolean
  token: string | null
  user: User | null
  organization: Organization | null
  role: string | null
  roles: string[]
  
  // Organization Data
  statuses: Status[]
  roles_list: Role[]
  departments: Department[]
  
  // Loading States
  isLoading: boolean
  isLoadingOrgData: boolean
  
  // Actions & Getters
  login: (data) => void
  logout: () => void
  setOrgData: (data) => void
  getTicketStatuses: () => Status[]
  getPriorityStatuses: () => Status[]
  hasRole: (roleName) => boolean
  isAdmin: () => boolean
}
```

## 🛠️ Advanced Usage

### Custom Selectors
```tsx
// Select specific fields only
const userName = useAuthStore(state => state.user?.name)
const tokenExpiry = useAuthStore(state => state.token ? 'valid' : 'expired')

// Performance optimization - only re-render when specific data changes
const ticketCount = useAuthStore(state => 
  state.statuses.filter(s => s.type === 'ticket').length
)
```

### Manual Store Updates
```tsx
const { setOrgData, updateUser } = useAuthActions()

// Update organization data
setOrgData({
  statuses: newStatuses,
  roles: newRoles,
  departments: newDepartments
})

// Update user profile
updateUser({ name: 'New Name' })
```

### Role-Based Access
```tsx
const { hasRole, isAdmin } = useAuth()

// Check specific roles
if (hasRole('Manager')) {
  return <ManagerDashboard />
}

// Check admin status
if (isAdmin()) {
  return <AdminControls />
}
```

## 🔄 Migration Support

The store includes version management for handling schema changes:

```typescript
// Current version is 1
// Migration logic handles upgrading from previous versions
migrate: (persistedState: any, version: number) => {
  if (version === 0) {
    return {
      ...persistedState,
      roles_list: persistedState.roles_list || [],
      departments: persistedState.departments || [],
    }
  }
  return persistedState
}
```

## 🎯 Best Practices

1. **Use selective hooks** instead of the main store to avoid unnecessary re-renders
2. **Wrap your app** with `HydrateStore` to handle SSR properly
3. **Use the ApiClient** instead of manual fetch calls for automatic store integration
4. **Handle loading states** with the provided loading flags
5. **Check authentication** before rendering protected components

## 🐛 Troubleshooting

### SSR Hydration Mismatch
- Make sure you're using `HydrateStore` wrapper
- Use `'use client'` directive in components that use the store

### Token Expiry
- The store automatically handles 401 responses by logging out the user
- Implement token refresh logic if needed

### Performance Issues
- Use selective hooks (`useAuth`, `useOrgData`) instead of the main store
- Create custom selectors for specific data to minimize re-renders