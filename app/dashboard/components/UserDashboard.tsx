'use client';

import React from 'react';
import { BarChart3, Ticket, TrendingUp, Clock, CheckCircle, AlertCircle } from 'lucide-react';

const UserDashboard = () => {
  // Mock user-specific data - replace with real API calls
  const userStats = [
    {
      title: 'My Open Tickets',
      value: '8',
      change: '+2',
      changeType: 'neutral',
      icon: AlertCircle,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    },
    {
      title: 'In Progress',
      value: '3',
      change: '+1',
      changeType: 'positive',
      icon: Clock,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Resolved This Week',
      value: '12',
      change: '+4',
      changeType: 'positive',
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Avg Resolution Time',
      value: '1.8h',
      change: '-0.3h',
      changeType: 'positive',
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    }
  ];

  const myTickets = [
    { 
      id: 'TCK-001', 
      title: 'Login page responsive issue', 
      status: 'In Progress', 
      priority: 'Medium',
      assignedDate: '2 days ago',
      project: 'E-commerce Platform'
    },
    { 
      id: 'TCK-015', 
      title: 'Database query optimization', 
      status: 'Open', 
      priority: 'High',
      assignedDate: '1 day ago',
      project: 'Analytics Dashboard'
    },
    { 
      id: 'TCK-023', 
      title: 'Email notification bug', 
      status: 'In Progress', 
      priority: 'Low',
      assignedDate: '3 hours ago',
      project: 'Customer Support Portal'
    },
    { 
      id: 'TCK-031', 
      title: 'Mobile app crash on startup', 
      status: 'Open', 
      priority: 'High',
      assignedDate: '30 mins ago',
      project: 'Mobile Banking App'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Open':
        return 'bg-red-100 text-red-800';
      case 'In Progress':
        return 'bg-blue-100 text-blue-800';
      case 'Resolved':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High':
        return 'text-red-500';
      case 'Medium':
        return 'text-yellow-500';
      case 'Low':
        return 'text-green-500';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Dashboard</h1>
          <p className="text-gray-600 mt-1">Track your tickets and progress</p>
        </div>
        <div className="text-sm text-gray-500">
          Welcome back, John Doe
        </div>
      </div>

      {/* User Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {userStats.map((stat, index) => (
          <div key={index} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{stat.value}</p>
              </div>
              <div className={`p-3 ${stat.bgColor} rounded-lg`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
            </div>
            <div className="flex items-center mt-4">
              <span className={`text-sm font-medium ${
                stat.changeType === 'positive' ? 'text-green-600' : 'text-gray-600'
              }`}>
                {stat.change}
              </span>
              <span className="text-sm text-gray-600 ml-1">from last week</span>
            </div>
          </div>
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* My Tickets */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">My Assigned Tickets</h3>
              <span className="text-sm text-gray-500">{myTickets.length} active</span>
            </div>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {myTickets.map((ticket) => (
                <div key={ticket.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <span className="font-mono text-sm text-blue-600 font-medium">{ticket.id}</span>
                      <AlertCircle className={`w-4 h-4 ${getPriorityColor(ticket.priority)}`} />
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>
                      {ticket.status}
                    </span>
                  </div>
                  
                  <h4 className="font-semibold text-gray-900 mb-1">{ticket.title}</h4>
                  
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>{ticket.project}</span>
                    <span>Assigned {ticket.assignedDate}</span>
                  </div>
                </div>
              ))}
            </div>
            <button className="w-full mt-4 py-2 text-blue-600 hover:text-blue-800 font-medium text-sm">
              View All My Tickets
            </button>
          </div>
        </div>

        {/* Quick Actions - Limited for Users */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
          </div>
          <div className="p-6 space-y-3">
            <button className="w-full flex items-center justify-between p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <span className="font-medium text-gray-900">Create New Ticket</span>
              <Ticket className="w-5 h-5 text-gray-400" />
            </button>
            <button className="w-full flex items-center justify-between p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <span className="font-medium text-gray-900">View Analytics</span>
              <BarChart3 className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Progress Summary */}
          <div className="p-6 border-t border-gray-100">
            <h4 className="font-medium text-gray-900 mb-3">This Week's Progress</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Tickets Completed</span>
                <span className="font-medium">12</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: '75%' }}></div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Weekly Goal</span>
                <span className="text-green-600 font-medium">75% Complete</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;