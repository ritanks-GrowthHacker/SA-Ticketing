'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, CheckCircle, Landmark, ArrowRight } from 'lucide-react';
import { useOrganizationStore } from '@/app/store/organizationStore';

interface Department {
  id: string;
  name: string;
  description: string;
  color_code?: string;
  is_active: boolean;
}

export default function OrganizationSetupPage() {
  const router = useRouter();
  const { currentOrg, getCurrentOrgId, updateCurrentOrgSetup } = useOrganizationStore();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fetch departments on component mount
  useEffect(() => {
    if (!currentOrg) {
      setError('No organization found. Please log in again.');
      router.push('/org-login');
      return;
    }
    fetchDepartments();
  }, [currentOrg, router]);

  const fetchDepartments = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/get-departments');
      const data = await response.json();
      
      if (data.success) {
        setDepartments(data.departments);
      } else {
        setError('Failed to load departments');
      }
    } catch (error) {
      setError('Error loading departments');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleDepartment = (departmentId: string) => {
    setSelectedDepartments(prev => 
      prev.includes(departmentId) 
        ? prev.filter(id => id !== departmentId)
        : [...prev, departmentId]
    );
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError('');
    
    try {
      const orgId = getCurrentOrgId();
      if (!orgId) {
        setError('No organization selected. Cannot save departments.');
        return;
      }
      
      if (selectedDepartments.length === 0) {
        setError('Please select at least one department for your organization');
        return;
      }

      // Save selected departments to organization
      const response = await fetch('/api/save-org-departments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orgId,
          selectedDepartments
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Update the store with setup completion
        updateCurrentOrgSetup(true, selectedDepartments);
        
        setSuccess('Departments saved successfully! Redirecting to dashboard...');
        setTimeout(() => {
          router.push('/organization-redirects/dashboard');
        }, 1500);
      } else {
        setError(data.error || 'Failed to save departments. Please try again.');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto w-20 h-20 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full flex items-center justify-center mb-6">
            <Building2 className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Setup Your Organization
          </h1>
          <p className="text-lg text-gray-600">
            Select the departments that exist in your organization
          </p>
          {currentOrg && (
            <div className="text-sm text-gray-500 mt-2">
              <p><strong>{currentOrg.name}</strong></p>
              <p>ID: {currentOrg.id}</p>
            </div>
          )}
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center">
              <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
              <p className="text-green-800">{success}</p>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <div className="space-y-8">
          
          {/* Department Selection Section */}
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="flex items-center mb-6">
              <Landmark className="w-6 h-6 text-indigo-600 mr-3" />
              <h2 className="text-2xl font-bold text-gray-900">
                Select Your Organization's Departments
              </h2>
            </div>
            
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {departments.map((dept) => (
                  <div
                    key={dept.id}
                    onClick={() => toggleDepartment(dept.id)}
                    className={`
                      relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200
                      ${selectedDepartments.includes(dept.id)
                        ? 'border-indigo-500 bg-indigo-50 shadow-md'
                        : 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow-sm'
                      }
                    `}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          <div
                            className="w-4 h-4 rounded-full mr-3"
                            style={{ backgroundColor: dept.color_code || '#6b7280' }}
                          ></div>
                          <h3 className="font-semibold text-gray-900">{dept.name}</h3>
                        </div>
                        <p className="text-sm text-gray-600">{dept.description}</p>
                      </div>
                      {selectedDepartments.includes(dept.id) && (
                        <CheckCircle className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="mt-4 text-sm text-gray-500">
              Selected: {selectedDepartments.length} department{selectedDepartments.length !== 1 ? 's' : ''}
            </div>
          </div>



          {/* Next Section */}
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Ready for the next step?
              </h3>
              <p className="text-gray-600">
                Save your department selection and continue to invite your team members.
              </p>
            </div>

            <button
              onClick={handleSubmit}
              disabled={isSubmitting || selectedDepartments.length === 0}
              className={`
                inline-flex items-center px-8 py-4 rounded-xl text-lg font-semibold transition-all
                ${isSubmitting || selectedDepartments.length === 0
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:from-indigo-700 hover:to-blue-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
                }
              `}
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <ArrowRight className="w-5 h-5 mr-2" />
                  Continue to Invite Team
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}