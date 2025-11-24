'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home, 
  FolderOpen, 
  User, 
  Ticket, 
  Menu, 
  X,
  ChevronRight,
  Clock,
  AlertCircle,
  Users,
  Shield,
  Inbox,
  DollarSign
} from 'lucide-react';
import { useAuthStore } from '../../app/store/authStore';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  managerOnly?: boolean;
  adminOrManager?: boolean;
  salesOnly?: boolean; // For sales-specific items
  nonSalesOnly?: boolean; // For non-sales items
}

interface TicketItem {
  id: string;
  title: string;
  status_id: string;
  priority_id: string;
  created_at: string;
  statuses?: { name: string; color_code: string };
  priorities?: { name: string; color_code: string };
}

const navItems: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: Home, nonSalesOnly: true },
  { name: 'Projects', href: '/projects', icon: FolderOpen, nonSalesOnly: true },
  { name: 'Requests', href: '/requests', icon: Inbox, adminOrManager: true, nonSalesOnly: true },
  { name: 'Manage Access', href: '/manage-access', icon: Users, adminOrManager: true, nonSalesOnly: true },
  { name: 'Profile', href: '/profile', icon: User, nonSalesOnly: true },
  { name: 'Tickets', href: '/tickets', icon: Ticket, nonSalesOnly: true },
  { name: 'Home', href: '/sales', icon: Home, salesOnly: true }, // Sales Dashboard as Home
  { name: 'Requests', href: '/requests', icon: Inbox, salesOnly: true, adminOnly: true }, // Only for Sales Admin
  { name: 'Sales', href: '/sales', icon: DollarSign }, // Always visible
];

const Sidebar = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [isSalesOnly, setIsSalesOnly] = useState(false);
  const pathname = usePathname();
  const { user, roles, currentProject, currentDepartment, role, token } = useAuthStore();

  // IMPORTANT: Sidebar visibility is based on ORG/DEPARTMENT role, NOT project role
  // Manage Access and Requests tabs are organization/department level features
  const effectiveRole = currentDepartment?.role || role || roles?.[0] || 'Member';

  // Check if user is Sales-only (only has Sales department role, no other departments)
  useEffect(() => {
    const checkSalesOnly = async () => {
      if (!token || !user) return;
      
      try {
        const response = await fetch('/api/check-user-departments', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          // User is sales-only if they only have Sales department and no other departments
          setIsSalesOnly(data.isSalesOnly || false);
        }
      } catch (error) {
        console.error('Error checking user departments:', error);
      }
    };

    checkSalesOnly();
  }, [token, user]);

  console.log('🔍 Sidebar - Role Check (Org/Dept Based):', {
    departmentRole: currentDepartment?.role,
    globalRole: role,
    rolesArray: roles,
    effectiveRole,
    isSalesOnly,
    note: 'Sidebar uses ORG/DEPT role, not project role'
  });

  // Fetch recent tickets based on user role
  useEffect(() => {
    const fetchRecentTickets = async () => {
      if (!token || !isExpanded) return; // Only fetch when sidebar is expanded
      
      setIsLoadingTickets(true);
      try {
        const response = await fetch('/api/search-tickets?limit=5', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          setTickets(data.tickets || []);
        }
      } catch (error) {
        console.error('Error fetching tickets:', error);
      } finally {
        setIsLoadingTickets(false);
      }
    };

    fetchRecentTickets();
  }, [token, isExpanded]);

  // Filter navigation items based on user role and sales-only status
  const filteredNavItems = navItems.filter(item => {
    // If user is sales-only
    if (isSalesOnly) {
      // Hide non-sales items
      if (item.nonSalesOnly) return false;
      // Show sales-only items
      if (item.salesOnly) return true;
      // For Sales tab (always visible), show it
      if (item.href === '/sales') return true;
      return false;
    }
    
    // If user is NOT sales-only
    else {
      // Hide sales-only items
      if (item.salesOnly) return false;
      // Show non-sales items based on role
      if (item.adminOnly) {
        return effectiveRole === 'Admin';
      }
      if (item.managerOnly) {
        return effectiveRole === 'Manager';
      }
      if (item.adminOrManager) {
        return effectiveRole === 'Admin' || effectiveRole === 'Manager';
      }
      return true;
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300';
      case 'in-progress':
        return 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300';
      case 'closed':
        return 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high':
        return <AlertCircle className="w-3 h-3 text-red-500" />;
      case 'medium':
        return <Clock className="w-3 h-3 text-yellow-500" />;
      case 'low':
        return <Clock className="w-3 h-3 text-green-500" />;
      default:
        return null;
    }
  };

  const truncateTitle = (title: string, maxLength: number = 25) => {
    return title.length > maxLength ? `${title.substring(0, maxLength)}...` : title;
  };

  return (
    <>
      {/* Dark overlay when sidebar is expanded */}
      {isExpanded && (
        <div 
          className="fixed inset-0 bg-black/50 dark:bg-black/70 z-40 transition-all duration-300 ease-in-out"
          onClick={() => setIsExpanded(false)}
        />
      )}
      
      {/* Sidebar */}
      <div className={`
        fixed left-0 top-0 h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 z-50 transition-all duration-300 ease-in-out
        ${isExpanded ? 'w-80' : 'w-16'}
        flex flex-col
      `}>
        {/* Toggle button */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            {isExpanded ? (
              <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            ) : (
              <Menu className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            )}
          </button>
          
          {isExpanded && (
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 dark:bg-blue-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-semibold text-sm">TM</span>
              </div>
              <span className="font-semibold text-gray-900 dark:text-gray-100">Ticketing Metrix</span>
            </div>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-4 space-y-2">
          <div className="space-y-1">
            {filteredNavItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`
                    flex items-center px-3 py-2 rounded-lg transition-colors group
                    ${isActive 
                      ? 'bg-blue-50 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800' 
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }
                  `}
                >
                  <item.icon className={`
                    w-5 h-5 shrink-0
                    ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300'}
                  `} />
                  {isExpanded && (
                    <span className="ml-3 font-medium">{item.name}</span>
                  )}
                  {!isExpanded && (
                    <div className="absolute left-16 bg-gray-900 dark:bg-gray-700 text-white dark:text-gray-100 px-2 py-1 rounded text-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                      {item.name}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Tickets Section */}
          {isExpanded && (
            <div className="pt-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900">Recent Tickets</h3>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
              
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {isLoadingTickets ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : tickets.length > 0 ? (
                  tickets.map((ticket) => (
                    <Link
                      key={ticket.id}
                      href={`/tickets`}
                      className="block p-3 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="text-sm font-medium text-gray-900 leading-tight">
                          {truncateTitle(ticket.title)}
                        </h4>
                        <div className={`w-2 h-2 rounded-full shrink-0 ml-2 mt-1`} 
                          style={{ backgroundColor: ticket.priorities?.color_code || '#6B7280' }}>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className={`
                          inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
                        `}
                          style={{ 
                            backgroundColor: ticket.statuses?.color_code ? `${ticket.statuses.color_code}20` : '#E5E7EB',
                            color: ticket.statuses?.color_code || '#6B7280'
                          }}
                        >
                          {ticket.statuses?.name || 'Unknown'}
                        </span>
                        
                        <span className="text-xs text-gray-500">
                          {new Date(ticket.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="text-center py-8 text-sm text-gray-500">
                    No recent tickets
                  </div>
                )}
              </div>
              
              <Link
                href="/tickets"
                className="block mt-3 text-center py-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                View All Tickets
              </Link>
            </div>
          )}
        </nav>

        {/* Collapse hint for mobile */}
        {isExpanded && (
          <div className="p-4 border-t border-gray-200 md:hidden">
            <p className="text-xs text-gray-500 text-center">
              Tap outside to close
            </p>
          </div>
        )}
      </div>
    </>
  );
};

export default Sidebar;
