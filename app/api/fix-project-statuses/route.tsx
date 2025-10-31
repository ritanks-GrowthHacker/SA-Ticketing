import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/db/connections';

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Manually inserting global project statuses...');

    // Insert global project statuses directly
    const defaultStatuses = [
      {
        id: 'f85e266d-7b75-4b08-b775-2fc17ca4b2a6',
        name: 'Planning',
        description: 'Project is in planning phase',
        color_code: '#f59e0b',
        sort_order: 1,
        is_active: true
      },
      {
        id: 'd05ef4b9-63be-42e2-b4a2-3d85537b9b7d',
        name: 'Active',
        description: 'Project is actively being worked on',
        color_code: '#10b981',
        sort_order: 2,
        is_active: true
      },
      {
        id: '9e001b85-22f5-435f-a95e-f546621c0ce3',
        name: 'On Hold',
        description: 'Project is temporarily paused',
        color_code: '#f97316',
        sort_order: 3,
        is_active: true
      },
      {
        id: 'af968d18-dfcc-4d69-93d9-9e7932155ccd',
        name: 'Review',
        description: 'Project is under review',
        color_code: '#3b82f6',
        sort_order: 4,
        is_active: true
      },
      {
        id: '66a0ccee-c989-4835-a828-bd9765958cf6',
        name: 'Completed',
        description: 'Project has been completed',
        color_code: '#6b7280',
        sort_order: 5,
        is_active: true
      }
    ];

    console.log('🔧 Inserting statuses:', defaultStatuses);

    const { data: insertedStatuses, error: insertError } = await supabase
      .from('project_statuses')
      .insert(defaultStatuses)
      .select('*');

    if (insertError) {
      console.error('🔥 Insert error:', insertError);
      return NextResponse.json(
        { 
          error: 'Failed to insert project statuses', 
          details: insertError.message 
        }, 
        { status: 500 }
      );
    }

    console.log('✅ Successfully inserted statuses:', insertedStatuses);

    return NextResponse.json({
      message: 'Project statuses created successfully',
      statuses: insertedStatuses,
      count: insertedStatuses?.length || 0
    });

  } catch (error) {
    console.error('🔥 General error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}