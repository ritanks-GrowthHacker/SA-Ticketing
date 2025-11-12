'use client';

import { useState } from 'react';

export default function UpdateDepartmentPage() {
  const [userId, setUserId] = useState('');
  const [department, setDepartment] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleUpdate = async () => {
    if (!userId || !department) {
      setMessage('Please fill in both fields');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/update-user-department', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, department }),
      });

      const result = await response.json();
      
      if (response.ok) {
        setMessage(`✅ Successfully updated user department to: ${department}`);
      } else {
        setMessage(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      setMessage(`❌ Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Update User Department</h1>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              User ID
            </label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Enter user ID (5a2f600d-4a5b-4747-a0d4-f2d0152a673f)"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Department
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Department</option>
              <option value="Engineering">Engineering</option>
              <option value="Marketing">Marketing</option>
              <option value="Sales">Sales</option>
              <option value="HR">HR</option>
              <option value="Finance">Finance</option>
              <option value="Operations">Operations</option>
            </select>
          </div>

          <button
            onClick={handleUpdate}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Updating...' : 'Update Department'}
          </button>

          {message && (
            <div className="mt-4 p-3 rounded-md bg-gray-100">
              <p className="text-sm">{message}</p>
            </div>
          )}
        </div>

        <div className="mt-6 text-sm text-gray-600">
          <p><strong>Your User ID from logs:</strong> 5a2f600d-4a5b-4747-a0d4-f2d0152a673f</p>
          <p className="mt-2">After updating, visit the organization dashboard to see the department segregation.</p>
        </div>
      </div>
    </div>
  );
}