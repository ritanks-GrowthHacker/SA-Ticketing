'use client';

import React, { useState } from 'react';
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
  AlertCircle
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface TicketItem {
  id: string;
  title: string;
  status: 'open' | 'in-progress' | 'closed';
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
}

const navItems: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Projects', href: '/projects', icon: FolderOpen },
  { name: 'Profile', href: '/profile', icon: User },
  { name: 'Tickets', href: '/tickets', icon: Ticket },
];

// Mock ticket data - replace with actual data from your API
const mockTickets: TicketItem[] = [
  {
    id: '1',
    title: 'Login issue with SSO',
    status: 'open',
    priority: 'high',
    createdAt: '2024-01-15'
  },
  {
    id: '2',
    title: 'Database connection timeout',
    status: 'in-progress',
    priority: 'medium',
    createdAt: '2024-01-14'
  },
  {
    id: '3',
    title: 'UI component styling',
    status: 'closed',
    priority: 'low',
    createdAt: '2024-01-13'
  },
  {
    id: '4',
    title: 'API rate limiting',
    status: 'open',
    priority: 'high',
    createdAt: '2024-01-12'
  },
  {
    id: '5',
    title: 'Mobile responsiveness',
    status: 'in-progress',
    priority: 'medium',
    createdAt: '2024-01-11'
  }
];

const Sidebar = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const pathname = usePathname();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-red-100 text-red-800';
      case 'in-progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'closed':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
          className="fixed inset-0  bg-opacity-50 z-40 transition-all duration-300 ease-in-out animate-in fade-in"
          style={{backgroundColor: "rgba(0, 0, 0, 0.5)",}}
          
          onClick={() => setIsExpanded(false)}
        />
      )}
      
      {/* Sidebar */}
      <div className={`
        fixed left-0 top-0 h-full bg-white border-r border-gray-200 z-50 transition-all duration-300 ease-in-out
        ${isExpanded ? 'w-80' : 'w-16'}
        flex flex-col
      `}>
        {/* Toggle button */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {isExpanded ? (
              <X className="w-5 h-5 text-gray-600" />
            ) : (
              <Menu className="w-5 h-5 text-gray-600" />
            )}
          </button>
          
          {isExpanded && (
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-semibold text-sm">TM</span>
              </div>
              <span className="font-semibold text-gray-900">Ticketing Metrix</span>
            </div>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-4 space-y-2">
          <div className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`
                    flex items-center px-3 py-2 rounded-lg transition-colors group
                    ${isActive 
                      ? 'bg-blue-50 text-blue-600 border border-blue-200' 
                      : 'text-gray-700 hover:bg-gray-100'
                    }
                  `}
                >
                  <item.icon className={`
                    w-5 h-5 shrink-0
                    ${isActive ? 'text-blue-600' : 'text-gray-500 group-hover:text-gray-700'}
                  `} />
                  {isExpanded && (
                    <span className="ml-3 font-medium">{item.name}</span>
                  )}
                  {!isExpanded && (
                    <div className="absolute left-16 bg-gray-900 text-white px-2 py-1 rounded text-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
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
                {mockTickets.map((ticket) => (
                  <Link
                    key={ticket.id}
                    href={`/tickets/${ticket.id}`}
                    className="block p-3 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="text-sm font-medium text-gray-900 leading-tight">
                        {truncateTitle(ticket.title)}
                      </h4>
                      {getPriorityIcon(ticket.priority)}
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className={`
                        inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
                        ${getStatusColor(ticket.status)}
                      `}>
                        {ticket.status}
                      </span>
                      
                      <span className="text-xs text-gray-500">
                        {new Date(ticket.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </Link>
                ))}
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
