import React from 'react';
import { BarChart3, Users, FolderOpen, Ticket, TrendingUp, Clock } from 'lucide-react';

const Dashboard = () => {
  const stats = [
    {
      title: 'Total Tickets',
      value: '1,234',
      change: '+12%',
      changeType: 'positive',
      icon: Ticket
    },
    {
      title: 'Active Projects',
      value: '28',
      change: '+5%',
      changeType: 'positive',
      icon: FolderOpen
    },
    {
      title: 'Team Members',
      value: '156',
      change: '+8%',
      changeType: 'positive',
      icon: Users
    },
    {
      title: 'Avg Resolution Time',
      value: '2.4h',
      change: '-15%',
      changeType: 'positive',
      icon: Clock
    }
  ];

  const recentTickets = [
    { id: 1, title: 'Database connection issue', status: 'High', time: '2 mins ago' },
    { id: 2, title: 'UI component bug', status: 'Medium', time: '15 mins ago' },
    { id: 3, title: 'Feature request: Dark mode', status: 'Low', time: '1 hour ago' },
    { id: 4, title: 'Performance optimization', status: 'Medium', time: '3 hours ago' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Welcome back! Here's what's happening with your projects.</p>
        </div>
        <div className="flex items-center space-x-3">
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            Create Ticket
          </button>
          <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
            Export Data
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{stat.value}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <stat.icon className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div className="flex items-center mt-4">
              <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
              <span className="text-sm font-medium text-green-600">{stat.change}</span>
              <span className="text-sm text-gray-600 ml-1">vs last month</span>
            </div>
          </div>
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">Recent Tickets</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {recentTickets.map((ticket) => (
                <div key={ticket.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                    <div>
                      <h4 className="font-medium text-gray-900">{ticket.title}</h4>
                      <p className="text-sm text-gray-600">{ticket.time}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    ticket.status === 'High' ? 'bg-red-100 text-red-800' :
                    ticket.status === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {ticket.status}
                  </span>
                </div>
              ))}
            </div>
            <button className="w-full mt-4 py-2 text-blue-600 hover:text-blue-800 font-medium text-sm">
              View All Tickets
            </button>
          </div>
        </div>

        {/* Quick Actions */}
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
              <span className="font-medium text-gray-900">Start New Project</span>
              <FolderOpen className="w-5 h-5 text-gray-400" />
            </button>
            <button className="w-full flex items-center justify-between p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <span className="font-medium text-gray-900">View Analytics</span>
              <BarChart3 className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;