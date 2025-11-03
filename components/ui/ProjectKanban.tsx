import React, { useState, useEffect } from 'react';
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  UniqueIdentifier,
  useDroppable,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  Folder, 
  Users, 
  Ticket, 
  Calendar, 
  TrendingUp,
  AlertCircle, 
  Clock, 
  CheckCircle, 
  Loader, 
  Info, 
  GripVertical,
  FolderOpen
} from 'lucide-react';
import { Project, ProjectStatus } from '../../app/store/projectStore';

interface ProjectKanbanProps {
  projects: Project[];
  onProjectStatusUpdate: (projectId: string, newStatusId: string) => Promise<boolean>;
  onProjectClick?: (projectId: string) => void;
  loading?: boolean;
  statuses?: ProjectStatus[];
  className?: string;
  compact?: boolean;
  onNotification?: (type: 'success' | 'error' | 'info', message: string) => void;
}

const ProjectKanban: React.FC<ProjectKanbanProps> = ({
  projects,
  onProjectStatusUpdate,
  onProjectClick,
  loading = false,
  statuses = [],
  className = '',
  compact = false,
  onNotification
}) => {
  const [isClient, setIsClient] = useState(false);
  const [localProjects, setLocalProjects] = useState(projects);
  const [updatingProjects, setUpdatingProjects] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Minimum distance to start dragging
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Client-side mounting
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Update local projects when props change
  useEffect(() => {
    setLocalProjects(projects);
  }, [projects]);

  // Create columns from API statuses only
  const columns = statuses.length > 0 
    ? statuses.map((status) => ({
        id: status.id,
        name: status.name,
        color: status.color_code || '#6b7280',
        bgColor: getStatusBgColor(status.color_code),
        textColor: getStatusTextColor(status.color_code),
        icon: getStatusIcon(status.name)
      }))
    : [];

  // Helper functions for status styling based on API data
  function getStatusBgColor(colorCode?: string): string {
    if (!colorCode) return 'bg-gray-50';
    const colorMap: { [key: string]: string } = {
      '#ef4444': 'bg-red-50',     // Red
      '#dc2626': 'bg-red-50',
      '#f59e0b': 'bg-yellow-50',  // Yellow/Amber
      '#d97706': 'bg-yellow-50',
      '#3b82f6': 'bg-blue-50',    // Blue
      '#2563eb': 'bg-blue-50',
      '#10b981': 'bg-green-50',   // Green
      '#059669': 'bg-green-50',
      '#6b7280': 'bg-gray-50',    // Gray
      '#4b5563': 'bg-gray-50',
      '#8b5cf6': 'bg-purple-50',  // Purple
      '#7c3aed': 'bg-purple-50',
      '#f97316': 'bg-orange-50',  // Orange
      '#ea580c': 'bg-orange-50',
    };
    return colorMap[colorCode.toLowerCase()] || 'bg-slate-50';
  }

  function getStatusTextColor(colorCode?: string): string {
    if (!colorCode) return 'text-gray-800';
    const colorMap: { [key: string]: string } = {
      '#ef4444': 'text-red-800',
      '#dc2626': 'text-red-800',
      '#f59e0b': 'text-yellow-800',
      '#d97706': 'text-yellow-800',
      '#3b82f6': 'text-blue-800',
      '#2563eb': 'text-blue-800',
      '#10b981': 'text-green-800',
      '#059669': 'text-green-800',
      '#6b7280': 'text-gray-800',
      '#4b5563': 'text-gray-800',
      '#8b5cf6': 'text-purple-800',
      '#7c3aed': 'text-purple-800',
      '#f97316': 'text-orange-800',
      '#ea580c': 'text-orange-800',
    };
    return colorMap[colorCode.toLowerCase()] || 'text-slate-800';
  }

  function getStatusIcon(statusName: string): React.ComponentType<any> {
    const name = statusName.toLowerCase();
    if (name.includes('planning') || name.includes('new') || name.includes('draft')) return FolderOpen;
    if (name.includes('active') || name.includes('progress') || name.includes('working')) return Clock;
    if (name.includes('hold') || name.includes('pause') || name.includes('waiting')) return AlertCircle;
    if (name.includes('review') || name.includes('testing') || name.includes('pending')) return Info;
    if (name.includes('completed') || name.includes('done') || name.includes('finished')) return CheckCircle;
    if (name.includes('cancelled') || name.includes('stopped')) return AlertCircle;
    return Folder; // Default
  }

  // Group projects by status
  const groupedProjects = columns.reduce((acc, column) => {
    acc[column.id] = localProjects.filter(project => project.status_id === column.id);
    return acc;
  }, {} as Record<string, Project[]>);

  // Projects grouped by status columns

  const activeProject = activeId ? localProjects.find(project => project.id === activeId) : null;

  // Don't render Kanban if no API statuses - this prevents mismatch issues
  if (statuses.length === 0 || columns.length === 0) {
    return (
      <div className="w-full p-8 text-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <h3 className="text-lg font-medium text-gray-600 mb-2">
          Project Kanban View Unavailable
        </h3>
        <p className="text-gray-500 mb-2">
          Unable to load project statuses from the server.
        </p>
        <p className="text-sm text-gray-400">
          Statuses loaded: {statuses.length} | Columns created: {columns.length}
        </p>
      </div>
    );
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    setActiveId(null);
    
    if (!over) {
      return; // No drop target
    }

    const projectId = active.id as string;
    let newStatusId = over.id as string;

    // Check if we dropped on another project (get the parent column)
    const overData = over.data?.current;
    if (overData?.type === 'project') {
      // Find which column this project belongs to
      const targetProject = localProjects.find(p => p.id === over.id);
      if (targetProject) {
        newStatusId = targetProject.status_id;
      }
    }

    // Find the project
    const project = localProjects.find(p => p.id === projectId);
    if (!project) {
      return; // Silently exit
    }

    // If dropping in the same column, do nothing
    if (project.status_id === newStatusId) {
      return; // No update needed
    }

    // Validate required data
    if (!projectId || !newStatusId) {
      return; // Silently exit
    }

    // Find the target status in our statuses array
    const targetStatus = statuses.find(s => s.id === newStatusId);
    
    // Silently handle invalid drop targets - no errors, no messages
    if (!targetStatus && statuses.length > 0) {
      return; // Just exit silently
    }

    // Silently handle missing API statuses
    if (statuses.length === 0) {
      return;
    }

    // Optimistically update UI
    const updatedProjects = localProjects.map(p => 
      p.id === projectId 
        ? { 
            ...p, 
            status_id: newStatusId, 
            status: targetStatus || p.status
          }
        : p
    );
    setLocalProjects(updatedProjects);
    
    // Add to updating set
    setUpdatingProjects(prev => new Set(prev).add(projectId));
    
    try {
      const success = await onProjectStatusUpdate(projectId, newStatusId);
      
      if (!success) {
        // Revert on failure and show notification
        setLocalProjects(projects);
        if (onNotification) {
          onNotification('error', 'Failed to update project status - insufficient permissions');
        }
      }
    } catch (error) {
      // Handle errors and revert
      setLocalProjects(projects);
      if (onNotification) {
        onNotification('error', 'Failed to update project status');
      }
    } finally {
      setUpdatingProjects(prev => {
        const newSet = new Set(prev);
        newSet.delete(projectId);
        return newSet;
      });
    }
  };

  // Sortable project component
  const SortableProjectItem: React.FC<{ project: Project }> = ({ project }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ 
      id: project.id,
      data: {
        type: 'project',
        project
      }
    });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    };

    const isUpdating = updatingProjects.has(project.id);

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`
          ${compact ? 'p-4' : 'p-5'} bg-gradient-to-br from-white to-gray-50 rounded-xl 
          border border-gray-200 shadow-sm hover:shadow-lg hover:border-blue-300 
          transition-all duration-300 cursor-pointer group relative overflow-hidden
          flex flex-col h-80
          ${isDragging ? 'opacity-75 shadow-2xl scale-105 rotate-2 z-50' : ''}
          ${isUpdating ? 'opacity-70' : ''}
        `}
        onClick={() => onProjectClick?.(project.id)}
        {...attributes}
        {...listeners}
      >
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-blue-50 to-transparent rounded-full opacity-50 -mr-10 -mt-10"></div>
        
        {/* Header Section */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
              <FolderOpen className="w-4 h-4 text-blue-600" />
            </div>
            {isUpdating && (
              <div className="flex items-center space-x-1">
                <Loader className="w-4 h-4 animate-spin text-blue-500" />
                <span className="text-xs text-blue-600 font-medium">Updating...</span>
              </div>
            )}
          </div>
          <GripVertical className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
        </div>
        
        {/* Content Section - grows to fill space */}
        <div className="flex-grow">
          <h4 className={`${compact ? 'text-base' : 'text-lg'} font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-blue-900 transition-colors`}>
            {project.name}
          </h4>
          
          {project.description && (
            <p className="text-sm text-gray-600 mb-4 line-clamp-2 leading-relaxed">
              {project.description}
            </p>
          )}
          
          {/* Progress Bar */}
          {project.progress_percentage !== undefined && (
            <div className="mb-4">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-medium text-gray-700">Progress</span>
                <span className="text-xs font-bold text-blue-600">{project.progress_percentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${project.progress_percentage}%` }}
                ></div>
              </div>
            </div>
          )}
          
          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs mb-4">
            {project.ticket_count !== undefined && (
              <div className="flex items-center space-x-2 bg-orange-50 rounded-lg p-2">
                <div className="p-1 bg-orange-100 rounded">
                  <Ticket className="w-3 h-3 text-orange-600" />
                </div>
                <div>
                  <div className="font-medium text-orange-900">{project.ticket_count}</div>
                  <div className="text-orange-700">Tickets</div>
                </div>
              </div>
            )}
            
            {project.team_members !== undefined && (
              <div className="flex items-center space-x-2 bg-green-50 rounded-lg p-2">
                <div className="p-1 bg-green-100 rounded">
                  <Users className="w-3 h-3 text-green-600" />
                </div>
                <div>
                  <div className="font-medium text-green-900">{project.team_members}</div>
                  <div className="text-green-700">Members</div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Footer Section - always at bottom */}
        <div className="mt-auto pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1 text-gray-500">
              <Calendar className="w-3 h-3" />
              <span className="text-xs">Created {new Date(project.created_at).toLocaleDateString()}</span>
            </div>
            {project.progress_percentage !== undefined && (
              <div className="flex items-center space-x-1">
                <TrendingUp className="w-3 h-3 text-blue-500" />
                <span className="text-xs font-medium text-blue-600">
                  {project.progress_percentage >= 100 ? 'Complete' : 
                   project.progress_percentage >= 75 ? 'Almost Done' : 
                   project.progress_percentage >= 50 ? 'In Progress' : 'Starting'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderProject = (project: Project) => {
    return <SortableProjectItem key={project.id} project={project} />;
  };

  // Droppable column component (for drag-enabled mode)
  const DroppableColumn: React.FC<{ column: any }> = ({ column }) => {
    const columnProjects = groupedProjects[column.id] || [];
    const IconComponent = column.icon;

    const { setNodeRef, isOver } = useDroppable({
      id: column.id,
      data: {
        type: 'column',
        columnId: column.id
      }
    });

    return (
      <div key={column.id} className="w-80 shrink-0">
        <div className={`${column.bgColor} rounded-lg p-3 mb-3`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <IconComponent className={`w-4 h-4 ${column.textColor}`} />
              <h3 className={`font-medium ${column.textColor}`}>{column.name}</h3>
            </div>
            <span className={`text-sm font-medium ${column.textColor} bg-white bg-opacity-50 px-2 py-1 rounded-full`}>
              {columnProjects.length}
            </span>
          </div>
        </div>
        
        <div
          ref={setNodeRef}
          className={`
            min-h-32 p-2 rounded-lg transition-colors
            ${isOver ? 'bg-blue-50 ring-2 ring-blue-300' : 'bg-gray-50'}
          `}
        >
          <SortableContext items={columnProjects.map(p => p.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3 flex flex-col">
              {columnProjects.map((project) => renderProject(project))}
            </div>
          </SortableContext>
          
          {columnProjects.length === 0 && (
            <div className="text-center py-8 text-gray-400 pointer-events-none">
              <Folder className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No projects</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!isClient) {
    return <div className="animate-pulse bg-gray-200 rounded-lg h-96" />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600">Loading projects...</span>
      </div>
    );
  }

  // Render content with drag functionality
  const kanbanContent = (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-0">
      <div className="flex gap-4 min-w-max">
        {columns.map((column) => (
          <DroppableColumn key={column.id} column={column} />
        ))}
      </div>
    </div>
  );

  return (
    <div className={className}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {kanbanContent}
        <DragOverlay>
          {activeProject ? (
            <div className="p-4 bg-white rounded-lg border-2 border-blue-300 shadow-lg opacity-95">
              <h4 className="font-medium text-gray-900 mb-2">{activeProject.name}</h4>
              <div className="text-xs text-gray-500">
                {activeProject.ticket_count && `${activeProject.ticket_count} tickets`}
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

export default ProjectKanban;