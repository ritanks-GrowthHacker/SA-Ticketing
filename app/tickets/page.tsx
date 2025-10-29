import React from 'react';
import { Plus, Search, Filter, MoreVertical, MessageSquare, Clock, AlertCircle } from 'lucide-react';

const Tickets = () => {
  const tickets = [
    {
      id: 'TCK-001',
      title: 'Database connection timeout error',
      description: 'Users are experiencing timeout errors when trying to connect to the database during peak hours.',
      status: 'Open',
      priority: 'High',
      assignee: 'John Smith',
      reporter: 'Sarah Johnson',
      created: '2024-01-15',
      updated: '2 hours ago',
      comments: 5,
      tags: ['backend', 'database']
    },
    {
      id: 'TCK-002',
      title: 'Login page UI improvements',
      description: 'Update the login page design to match the new brand guidelines and improve user experience.',
      status: 'In Progress',
      priority: 'Medium',
      assignee: 'Emily Davis',
      reporter: 'Mike Wilson',
      created: '2024-01-14',
      updated: '1 day ago',
      comments: 3,
      tags: ['frontend', 'ui', 'design']
    },
    {
      id: 'TCK-003',
      title: 'Add dark mode toggle',
      description: 'Implement a dark mode toggle feature across all pages of the application.',
      status: 'Open',
      priority: 'Low',
      assignee: 'Alex Chen',
      reporter: 'Lisa Brown',
      created: '2024-01-13',
      updated: '3 days ago',
      comments: 7,
      tags: ['frontend', 'feature']
    },
    {
      id: 'TCK-004',
      title: 'API rate limiting implementation',
      description: 'Implement rate limiting for all API endpoints to prevent abuse and improve performance.',
      status: 'Closed',
      priority: 'High',
      assignee: 'David Kim',
      reporter: 'Tom Anderson',
      created: '2024-01-10',
      updated: '5 days ago',
      comments: 12,
      tags: ['backend', 'api', 'security']
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Open':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'In Progress':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Closed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'On Hold':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'High':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'Medium':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'Low':
        return <Clock className="w-4 h-4 text-green-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tickets</h1>
          <p className="text-gray-600 mt-1">Track and manage support tickets</p>
        </div>
        <button className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" />
          <span>Create Ticket</span>
        </button>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-3 md:space-y-0">
          {/* Search */}
          <div className="relative flex-1 md:max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search tickets..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center space-x-3">
            <button className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm">Filter</span>
            </button>
            
            <select className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option>All Status</option>
              <option>Open</option>
              <option>In Progress</option>
              <option>Closed</option>
            </select>
            
            <select className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option>All Priority</option>
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">127</p>
            <p className="text-sm text-gray-600">Total Tickets</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-center">
            <p className="text-2xl font-bold text-red-600">23</p>
            <p className="text-sm text-gray-600">Open</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-center">
            <p className="text-2xl font-bold text-yellow-600">45</p>
            <p className="text-sm text-gray-600">In Progress</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">59</p>
            <p className="text-sm text-gray-600">Resolved</p>
          </div>
        </div>
      </div>

      {/* Tickets List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-medium text-gray-900">Recent Tickets</h3>
        </div>
        
        <div className="divide-y divide-gray-200">
          {tickets.map((ticket) => (
            <div key={ticket.id} className="p-6 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* Ticket Header */}
                  <div className="flex items-center space-x-3 mb-2">
                    <span className="font-mono text-sm text-blue-600 font-medium">{ticket.id}</span>
                    {getPriorityIcon(ticket.priority)}
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(ticket.status)}`}>
                      {ticket.status}
                    </span>
                  </div>
                  
                  {/* Title and Description */}
                  <h4 className="text-lg font-semibold text-gray-900 mb-1">{ticket.title}</h4>
                  <p className="text-gray-600 mb-3 line-clamp-2">{ticket.description}</p>
                  
                  {/* Tags */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {ticket.tags.map((tag) => (
                      <span key={tag} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                        {tag}
                      </span>
                    ))}
                  </div>
                  
                  {/* Meta Info */}
                  <div className="flex items-center space-x-6 text-sm text-gray-500">
                    <span>Assigned to <strong>{ticket.assignee}</strong></span>
                    <span>Reported by <strong>{ticket.reporter}</strong></span>
                    <span>Updated {ticket.updated}</span>
                    <div className="flex items-center space-x-1">
                      <MessageSquare className="w-4 h-4" />
                      <span>{ticket.comments}</span>
                    </div>
                  </div>
                </div>
                
                {/* Action Menu */}
                <button className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
                  <MoreVertical className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
        
        {/* Load More */}
        <div className="px-6 py-4 border-t border-gray-200 text-center">
          <button className="text-blue-600 hover:text-blue-800 font-medium text-sm">
            Load More Tickets
          </button>
        </div>
      </div>
    </div>
  );
};

export default Tickets;