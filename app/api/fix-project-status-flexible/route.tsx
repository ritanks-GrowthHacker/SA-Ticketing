import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { supabase } from '@/app/db/connections';

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Starting flexible project status migration...');

    // Get auth token
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decodedToken = jwt.decode(token) as any;

    if (!decodedToken) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    console.log('👤 Token decoded:', {
      userId: decodedToken.user_id,
      orgId: decodedToken.org_id,
      role: decodedToken.role
    });

    // First, let's see what project statuses are available
    const { data: allProjectStatuses } = await supabase
      .from('project_statuses')
      .select('*');

    console.log('📋 All project statuses in database:', allProjectStatuses);

    // Get the "Active" status from the data you provided
    const activeStatusId = 'd05ef4b9-63be-42e2-b4a2-3d85537b9b7d';
    const activeStatus = allProjectStatuses?.find(s => s.id === activeStatusId);

    if (!activeStatus) {
      // Fallback to any Active status
      const anyActiveStatus = allProjectStatuses?.find(s => s.name === 'Active');
      if (anyActiveStatus) {
        console.log('📌 Using any Active status found:', anyActiveStatus);
        return await updateProjects(anyActiveStatus.id, anyActiveStatus);
      }
      
      return NextResponse.json({
        error: 'No Active status found',
        available_statuses: allProjectStatuses
      }, { status: 400 });
    }

    console.log('✅ Using Active status:', activeStatus);
    return await updateProjects(activeStatusId, activeStatus);

  } catch (error) {
    console.error('💥 Migration error:', error);
    return NextResponse.json(
      { error: 'Migration failed', details: error }, 
      { status: 500 }
    );
  }
}

async function updateProjects(statusId: string, activeStatus: any) {
  // Get ALL projects that don't have a status_id
  const { data: allProjects, error: allProjectsError } = await supabase
    .from('projects')
    .select('*');

  console.log('📊 All projects in database:', {
    count: allProjects?.length || 0,
    projects: allProjects
  });

  const { data: projectsToUpdate, error: projectsError } = await supabase
    .from('projects')
    .select('id, name, status_id, organization_id')
    .is('status_id', null);

  if (projectsError) {
    console.error('❌ Error fetching projects:', projectsError);
    return NextResponse.json(
      { error: 'Failed to fetch projects', details: projectsError }, 
      { status: 500 }
    );
  }

  console.log('📊 Projects to update:', {
    count: projectsToUpdate?.length || 0,
    projects: projectsToUpdate
  });

  if (!projectsToUpdate || projectsToUpdate.length === 0) {
    return NextResponse.json({
      success: true,
      message: 'No projects need status updates',
      projects_checked: allProjects?.length || 0,
      projects_updated: 0
    });
  }

  // Update all projects to have the Active status
  const projectIds = projectsToUpdate.map(p => p.id);
  
  const { data: updateResult, error: updateError } = await supabase
    .from('projects')
    .update({ status_id: statusId })
    .in('id', projectIds)
    .select();

  if (updateError) {
    console.error('❌ Error updating projects:', updateError);
    return NextResponse.json(
      { error: 'Failed to update projects', details: updateError }, 
      { status: 500 }
    );
  }

  console.log('✅ Projects updated successfully:', updateResult);

  return NextResponse.json({
    success: true,
    message: `Successfully updated ${projectsToUpdate.length} projects to Active status`,
    status_used: activeStatus,
    projects_updated: projectsToUpdate.length,
    updated_projects: updateResult
  });
}