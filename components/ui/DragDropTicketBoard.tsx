'use client';

import React, { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  closestCorners,
  pointerWithin,
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
import { Ticket, AlertCircle, Clock, CheckCircle, Loader, Info, GripVertical } from 'lucide-react';

interface TicketItem {
  id: string;
  title: string;
  status: string;
  status_id?: string;
  priority: string;
  priority_id?: string;
  assignedTo?: string;
  createdBy?: string;
  created_by?: string; // Alternative field name
  assigned_to?: string; // Alternative field name
  project?: string;
  time?: string;
  assignedDate?: string;
  description?: string;
}

interface StatusColumn {
  id: string;
  name: string;
  color: string;
  bgColor: string;
  textColor: string;
  icon: React.ComponentType<any>;
}

interface DragDropTicketBoardProps {
  tickets: TicketItem[];
  onTicketUpdate: (ticketId: string, newStatusId: string) => Promise<boolean>;
  onTicketClick?: (ticketId: string) => void;
  loading?: boolean;
  statuses?: Array<{ id: string; name: string; color_code?: string; type: string }>;
  className?: string;
  compact?: boolean;
}

const DragDropTicketBoard: React.FC<DragDropTicketBoardProps> = ({
  tickets,
  onTicketUpdate,
  onTicketClick,
  loading = false,
  statuses = [],
  className = '',
  compact = false
}) => {
  const [isClient, setIsClient] = useState(false);
  const [localTickets, setLocalTickets] = useState(tickets);
  const [updatingTickets, setUpdatingTickets] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Require movement and delay to distinguish from clicks
      activationConstraint: {
        distance: 10,  // Require 10px movement
        delay: 150,    // 150ms delay before drag starts
        tolerance: 8,  // Allow 8px tolerance for movement detection
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle client-side only rendering for drag-and-drop
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    setLocalTickets(tickets);
  }, [tickets]);

  // ONLY use API statuses - create columns from database statuses only
  const columns: StatusColumn[] = statuses.length > 0 
    ? statuses.map((status) => ({
        id: status.id,
        name: status.name,
        color: status.color_code || '#6b7280',
        bgColor: getStatusBgColor(status.color_code),
        textColor: getStatusTextColor(status.color_code),
        icon: getStatusIcon(status.name)
      }))
    : [];

  // Columns created from API statuses

  // Helper functions for status styling based on API data
  function getStatusBgColor(colorCode?: string): string {
    if (!colorCode) return 'bg-gray-50';
    // Map hex colors to Tailwind background classes
    const colorMap: { [key: string]: string } = {
      '#ef4444': 'bg-red-50',    // Red
      '#dc2626': 'bg-red-50',
      '#f59e0b': 'bg-yellow-50',  // Yellow/Amber
      '#d97706': 'bg-yellow-50',
      '#3b82f6': 'bg-blue-50',    // Blue
      '#2563eb': 'bg-blue-50',
      '#10b981': 'bg-green-50',  // Green
      '#059669': 'bg-green-50',
      '#6b7280': 'bg-gray-50',    // Gray
      '#4b5563': 'bg-gray-50',
      '#8b5cf6': 'bg-purple-50',  // Purple
      '#7c3aed': 'bg-purple-50',
      '#f97316': 'bg-orange-50',  // Orange
      '#ea580c': 'bg-orange-50',
      '#06b6d4': 'bg-cyan-50',    // Cyan
      '#0891b2': 'bg-cyan-50'
    };
    return colorMap[colorCode.toLowerCase()] || 'bg-slate-50';
  }

  function getStatusTextColor(colorCode?: string): string {
    if (!colorCode) return 'text-gray-800';
    // Map hex colors to Tailwind text classes
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
      '#06b6d4': 'text-cyan-800',
      '#0891b2': 'text-cyan-800'
    };
    return colorMap[colorCode.toLowerCase()] || 'text-slate-800';
  }

  function getStatusIcon(statusName: string): React.ComponentType<any> {
    const name = statusName.toLowerCase();
    // Match common status naming patterns
    if (name.includes('open') || name.includes('new') || name.includes('created')) return AlertCircle;
    if (name.includes('progress') || name.includes('working') || name.includes('active')) return Clock;
    if (name.includes('review') || name.includes('testing') || name.includes('pending')) return Info;
    if (name.includes('done') || name.includes('complete') || name.includes('closed') || name.includes('resolved')) return CheckCircle;
    return AlertCircle; // Default fallback
  }

  // Helper to extract color name from hex
  function getColorFromHex(hex?: string): string {
    if (!hex) return 'gray';
    // Simple mapping - in production you'd want a more sophisticated hex to tailwind color mapping
    const colorMap: { [key: string]: string } = {
      '#ef4444': 'red',
      '#f59e0b': 'yellow', 
      '#3b82f6': 'blue',
      '#10b981': 'green',
      '#6b7280': 'gray'
    };
    return colorMap[hex.toLowerCase()] || 'gray';
  }

  // Group tickets by status with improved logic
  const groupedTickets = columns.reduce((acc, column) => {
    acc[column.id] = localTickets.filter(ticket => {
      // Method 1: Direct status_id match (most reliable)
      if (ticket.status_id && ticket.status_id === column.id) {
        return true;
      }

      // Method 2: Match ticket status name with API status name
      if (statuses.length > 0 && ticket.status) {
        const apiStatus = statuses.find(s => s.id === column.id);
        if (apiStatus && ticket.status.toLowerCase() === apiStatus.name.toLowerCase()) {
          return true;
        }
      }

      // Method 3: Match ticket status with column name (for default columns)
      if (ticket.status && column.name) {
        const ticketStatus = ticket.status.toLowerCase().trim();
        const columnName = column.name.toLowerCase().trim();
        
        // Direct match
        if (ticketStatus === columnName) {
          return true;
        }
        
        // Handle common variations
        const statusVariations = [
          ticketStatus.replace(/\s+/g, '_'),
          ticketStatus.replace(/[_\s]+/g, ''),
          ticketStatus
        ];
        
        const columnVariations = [
          columnName.replace(/\s+/g, '_'),
          columnName.replace(/[_\s]+/g, ''),
          columnName,
          column.id.toLowerCase()
        ];
        
        for (const statusVar of statusVariations) {
          for (const colVar of columnVariations) {
            if (statusVar === colVar || statusVar.includes(colVar) || colVar.includes(statusVar)) {
              return true;
            }
          }
        }
      }

      return false;
    });
    return acc;
  }, {} as Record<string, TicketItem[]>);

  // Tickets grouped by status columns



  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    // CRITICAL: Block ALL drag operations if no API statuses
    if (statuses.length === 0) {
      console.warn('⚠️ DRAG IGNORED: No API statuses loaded - this was likely a click, not a drag');
      return;
    }

    // CRITICAL: Block ALL drag operations if no columns
    if (columns.length === 0) {
      console.warn('⚠️ DRAG IGNORED: No columns available - this was likely a click, not a drag');
      return;
    }

    // Early return if no valid drop target (this happens with clicks/drags that go out of bounds)
    if (!over) {
      return; // No drop target
    }

    const ticketId = active.id as string;
    let newStatusId = over.id as string;
    
    // Use data attributes to better determine drop target
    const overData = over.data?.current;
    
    if (overData?.type === 'ticket') {
      // Dropped on another ticket - use its status/column
      newStatusId = overData.statusId || newStatusId;
      
      // Double-check by finding the column this ticket belongs to
      for (const column of columns) {
        const ticketsInColumn = groupedTickets[column.id] || [];
        if (ticketsInColumn.some(t => t.id === overData.ticketId)) {
          newStatusId = column.id;
          break;
        }
      }
    } else if (overData?.type === 'column') {
      // Dropped directly on column - use column ID
      newStatusId = overData.columnId || newStatusId;
    } else {
      // Fallback - check if we're dropping on another ticket
      const targetTicket = localTickets.find(t => t.id === newStatusId);
      if (targetTicket) {
        for (const column of columns) {
          const ticketsInColumn = groupedTickets[column.id] || [];
          if (ticketsInColumn.some(t => t.id === newStatusId)) {
            newStatusId = column.id;
            break;
          }
        }
      }
    }

    // Find the ticket
    const ticket = localTickets.find(t => t.id === ticketId);
    if (!ticket) {
      return; // Silently exit
    }

    // Find current status ID by checking which column currently contains this ticket
    let currentStatusId: string | undefined;

    // Check each column to see which one currently contains this ticket
    for (const column of columns) {
      const ticketsInColumn = groupedTickets[column.id] || [];
      if (ticketsInColumn.some(t => t.id === ticketId)) {
        currentStatusId = column.id;
        break;
      }
    }

    // If dropping in the same column, do nothing
    if (currentStatusId === newStatusId) {
      return; // No update needed
    }


    // Validate required data
    if (!ticketId || !newStatusId || !currentStatusId) {
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
    const updatedTickets = localTickets.map(t => 
      t.id === ticketId 
        ? { 
            ...t, 
            status_id: newStatusId, 
            status: targetStatus?.name || columns.find(col => col.id === newStatusId)?.name || t.status 
          }
        : t
    );
    setLocalTickets(updatedTickets);
    setUpdatingTickets(prev => new Set([...prev, ticketId]));

    try {
      const success = await onTicketUpdate(ticketId, newStatusId);
      
      if (!success) {
        // Silently revert on failure
        setLocalTickets(tickets);
      }
    } catch (error) {
      // Silently handle errors and revert
      setLocalTickets(tickets);
    } finally {
      setUpdatingTickets(prev => {
        const newSet = new Set(prev);
        newSet.delete(ticketId);
        return newSet;
      });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return 'text-red-600';
      case 'medium':
        return 'text-yellow-600';
      case 'low':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  };

  // Sortable ticket item component
  const SortableTicketItem: React.FC<{ ticket: TicketItem }> = ({ ticket }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ 
      id: ticket.id,
      data: {
        type: 'ticket',
        ticketId: ticket.id,
        statusId: ticket.status_id
      }
    });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    };

    const isUpdating = updatingTickets.has(ticket.id);

    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={`
          ${compact ? 'p-3' : 'p-4'} 
          bg-white border border-gray-200 rounded-lg shadow-sm 
          hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing relative
          ${isDragging ? 'shadow-lg z-50' : ''}
          ${isUpdating ? 'opacity-60' : ''}
        `}
        onClick={(e) => {
          // Only trigger click if not actually dragging
          if (!isDragging) {
            onTicketClick?.(ticket.id);
          }
        }}
      >
        {isUpdating && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 rounded-lg z-10">
            <Loader className="w-4 h-4 animate-spin text-blue-600" />
          </div>
        )}
        
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center space-x-2">
            <span className="font-mono text-xs text-gray-500">#{ticket.id.slice(-8)}</span>
            <AlertCircle className={`w-3 h-3 ${getPriorityColor(ticket.priority)}`} />
          </div>
          <div className="flex items-center space-x-2">
            <GripVertical className="w-4 h-4 text-gray-400" />
            {ticket.priority && (
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                ticket.priority === 'High' ? 'bg-red-100 text-red-800' :
                ticket.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                'bg-green-100 text-green-800'
              }`}>
                {ticket.priority}
              </span>
            )}
          </div>
        </div>
        
        <h4 className={`${compact ? 'text-sm' : 'text-base'} font-medium text-gray-900 mb-2 line-clamp-2`}>
          {ticket.title}
        </h4>
        
        <div className="text-xs text-gray-500 space-y-1">
          {ticket.project && <div>📁 {ticket.project}</div>}
          {/* Show Created By */}
          {(ticket.createdBy || ticket.created_by) && (
            <div>👨‍💻 Created By: {ticket.createdBy || ticket.created_by}</div>
          )}
          {/* Show Assigned To */}
          {(ticket.assignedTo || ticket.assigned_to) && (
            <div>👤 Assigned To: {ticket.assignedTo || ticket.assigned_to}</div>
          )}
          {(ticket.time || ticket.assignedDate) && <div>🕒 {ticket.time || ticket.assignedDate}</div>}
        </div>
      </div>
    );
  };

  const renderTicket = (ticket: TicketItem) => {
    return <SortableTicketItem key={ticket.id} ticket={ticket} />;
  };

  // Droppable column component (for drag-enabled mode)
  const DroppableColumn: React.FC<{ column: StatusColumn }> = ({ column }) => {
    const columnTickets = groupedTickets[column.id] || [];
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
              {columnTickets.length}
            </span>
          </div>
        </div>
        
        <div
          ref={setNodeRef}
          className={`
            space-y-3 min-h-32 p-2 rounded-lg transition-colors
            ${isOver ? 'bg-blue-50 ring-2 ring-blue-300' : 'bg-gray-50'}
          `}
        >
          <SortableContext items={columnTickets.map(t => t.id)} strategy={verticalListSortingStrategy}>
            {columnTickets.map((ticket) => renderTicket(ticket))}
          </SortableContext>
          
          {columnTickets.length === 0 && (
            <div className="text-center py-8 text-gray-400 pointer-events-none">
              <Ticket className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No tickets</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Static column component (for non-drag mode when no API statuses)
  const StaticColumn: React.FC<{ column: StatusColumn }> = ({ column }) => {
    const columnTickets = groupedTickets[column.id] || [];
    const IconComponent = column.icon;

    return (
      <div key={column.id} className="w-80 shrink-0">
        <div className={`${column.bgColor} rounded-lg p-3 mb-3`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <IconComponent className={`w-4 h-4 ${column.textColor}`} />
              <h3 className={`font-medium ${column.textColor}`}>{column.name}</h3>
            </div>
            <span className={`text-sm font-medium ${column.textColor} bg-white bg-opacity-50 px-2 py-1 rounded-full`}>
              {columnTickets.length}
            </span>
          </div>
        </div>
        
        <div className="space-y-3 min-h-32 p-2 rounded-lg bg-gray-50">
          {columnTickets.map((ticket) => (
            <div
              key={ticket.id}
              className="bg-white p-4 rounded-lg shadow-sm border cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => onTicketClick?.(ticket.id)}
            >
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-medium text-gray-900 text-sm line-clamp-2">
                  {ticket.title}
                </h4>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded ml-2 whitespace-nowrap">
                  #{ticket.id}
                </span>
              </div>
              {ticket.description && (
                <p className="text-sm text-gray-600 line-clamp-2 mb-2">{ticket.description}</p>
              )}
              <div className="flex justify-between items-center text-xs text-gray-500">
                <span>{ticket.priority || 'Medium'}</span>
                <span>Ticket #{ticket.id.slice(-4)}</span>
              </div>
            </div>
          ))}
          
          {columnTickets.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <Ticket className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No tickets</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderColumn = (column: StatusColumn) => {
    // Use droppable version only if we have API statuses, otherwise use static
    const isDragEnabled = statuses.length > 0 && columns.length > 0;
    return isDragEnabled ? (
      <DroppableColumn key={column.id} column={column} />
    ) : (
      <StaticColumn key={column.id} column={column} />
    );
  };

  // Don't render on server-side
  if (!isClient) {
    return (
      <div className={`${className} space-y-4`}>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-300 rounded mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="space-y-3">
                <div className="h-16 bg-gray-200 rounded-lg"></div>
                <div className="h-24 bg-gray-100 rounded-lg"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`${className} flex items-center justify-center py-12`}>
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-500">Loading tickets...</p>
        </div>
      </div>
    );
  }

  const activeTicket = activeId ? localTickets.find(ticket => ticket.id === activeId) : null;

  // If no API statuses loaded, show message
  if (statuses.length === 0) {
    return (
      <div className={`${className} text-center py-12 bg-yellow-50 border border-yellow-200 rounded-lg`}>
        <AlertCircle className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-yellow-800 mb-2">Kanban View Unavailable</h3>
        <p className="text-yellow-600">
          Unable to load ticket statuses from your organization. Please check your connection and try again.
        </p>
        <p className="text-sm text-yellow-500 mt-2">
          Switch back to List View or refresh the page.
        </p>
      </div>
    );
  }

  // Render content with or without drag functionality based on API status availability
  const kanbanContent = (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-0">
      <div className="flex gap-4 min-w-max">
        {columns.map(renderColumn)}
      </div>
    </div>
  );

  return (
    <div className={className}>
      {/* Only enable drag-drop if we have valid API statuses and columns */}
      {statuses.length > 0 && columns.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {kanbanContent}
          
          <DragOverlay>
            {activeTicket ? (
              <div className="transform rotate-6 opacity-95">
                <SortableTicketItem ticket={activeTicket} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        /* Render static (non-draggable) version when no API statuses */
        kanbanContent
      )}
      
      {localTickets.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Ticket className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No tickets found</p>
        </div>
      )}
    </div>
  );
};

export default DragDropTicketBoard;