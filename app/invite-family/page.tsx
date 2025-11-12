'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Mail, Plus, Trash2, CheckCircle, Heart, Send } from 'lucide-react';
import { useOrganizationStore } from '@/app/store/organizationStore';

interface Department {
  id: string;
  name: string;
  description: string;
  color_code?: string;
  is_active: boolean;
}

interface TeamMember {
  id: string;
  email: string;
  department: string;
}

export default function InviteFamilyPage() {
  const router = useRouter();
  const { currentOrg, getCurrentOrgId } = useOrganizationStore();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([
    { id: '1', email: '', department: '' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fetch organization departments on component mount
  useEffect(() => {
    if (!currentOrg) {
      setError('No organization found. Please log in again.');
      router.push('/org-login');
      return;
    }
    fetchOrganizationDepartments();
  }, [currentOrg, router]);

  const fetchOrganizationDepartments = async () => {
    const orgId = getCurrentOrgId();
    if (!orgId) {
      setError('No organization selected');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/get-org-departments?orgId=${orgId}`);
      const data = await response.json();
      
      if (data.success) {
        setDepartments(data.departments);
      } else {
        setError('Failed to load organization departments');
      }
    } catch (error) {
      setError('Error loading departments');
    } finally {
      setIsLoading(false);
    }
  };

  const addTeamMember = () => {
    setTeamMembers(prev => [
      ...prev,
      { 
        id: Date.now().toString(), 
        email: '', 
        department: '' 
      }
    ]);
  };

  const removeTeamMember = (id: string) => {
    if (teamMembers.length > 1) {
      setTeamMembers(prev => prev.filter(member => member.id !== id));
    }
  };

  const updateTeamMember = (id: string, field: keyof TeamMember, value: string) => {
    setTeamMembers(prev => prev.map(member => 
      member.id === id ? { ...member, [field]: value } : member
    ));
  };

  const handleInviteFamily = async () => {
    setIsSubmitting(true);
    setError('');
    
    try {
      // Validate data
      const validMembers = teamMembers.filter(member => member.email && member.department);
      
      if (validMembers.length === 0) {
        setError('Please add at least one team member with email and department');
        return;
      }

      // Check for duplicate emails
      const emails = validMembers.map(m => m.email.toLowerCase());
      const uniqueEmails = new Set(emails);
      if (emails.length !== uniqueEmails.size) {
        setError('Duplicate email addresses found. Please use unique emails.');
        return;
      }

      // Send invitations
      const orgId = getCurrentOrgId();
      if (!orgId) {
        setError('No organization selected');
        return;
      }

      const response = await fetch('/api/invite-team-members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orgId,
          teamMembers: validMembers
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(`Successfully sent invitations to ${validMembers.length} team member${validMembers.length > 1 ? 's' : ''}!`);
        setTimeout(() => {
          router.push('/organization-redirects/dashboard');
        }, 3000);
      } else {
        setError(data.error || 'Failed to send invitations. Please try again.');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-100 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto w-20 h-20 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center mb-6">
            <Heart className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Let's Create Your Family! 👨‍👩‍👧‍👦
          </h1>
          <p className="text-lg text-gray-600">
            Invite your team members to join your organization
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

        {/* Team Members Invitation Section */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <Users className="w-6 h-6 text-purple-600 mr-3" />
              <h2 className="text-2xl font-bold text-gray-900">
                Invite Your Team Members
              </h2>
            </div>
            <button
              onClick={addTeamMember}
              className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Member
            </button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {teamMembers.map((member, index) => (
                <div key={member.id} className="border border-gray-200 rounded-xl p-6 hover:border-purple-300 transition-colors">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                      <Mail className="w-5 h-5 text-purple-600 mr-2" />
                      Team Member #{index + 1}
                    </h3>
                    {teamMembers.length > 1 && (
                      <button
                        onClick={() => removeTeamMember(member.id)}
                        className="text-red-500 hover:text-red-700 transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        value={member.email}
                        onChange={(e) => updateTeamMember(member.id, 'email', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                        placeholder="john@company.com"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Department *
                      </label>
                      <select
                        value={member.department}
                        onChange={(e) => updateTeamMember(member.id, 'department', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                      >
                        <option value="">Select Department</option>
                        {departments.map((dept) => (
                          <option key={dept.id} value={dept.id}>
                            {dept.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quick Add Email Section */}
          <div className="mt-6 p-4 bg-purple-50 rounded-lg border-2 border-dashed border-purple-200">
            <p className="text-sm text-purple-700 text-center">
              💡 <strong>Tip:</strong> You can add multiple team members and assign them to different departments. 
              Each person will receive a personalized invitation email!
            </p>
          </div>
        </div>

        {/* Invite Button */}
        <div className="mt-8 bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Ready to Invite Your Family?
            </h3>
            <p className="text-gray-600">
              We'll send beautiful invitation emails to all your team members with instructions to join your organization.
            </p>
          </div>

          <button
            onClick={handleInviteFamily}
            disabled={isSubmitting || teamMembers.filter(m => m.email && m.department).length === 0}
            className={`
              inline-flex items-center px-8 py-4 rounded-xl text-lg font-semibold transition-all
              ${isSubmitting || teamMembers.filter(m => m.email && m.department).length === 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-pink-500 to-purple-600 text-white hover:from-pink-600 hover:to-purple-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
              }
            `}
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Sending Invitations...
              </>
            ) : (
              <>
                <Send className="w-5 h-5 mr-2" />
                Invite My Family! 💌
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}