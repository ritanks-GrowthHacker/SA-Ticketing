'use client';

import React, { useState, useRef, useEffect } from 'react';
import { User } from 'lucide-react';
import { getDevAuthHeader } from '@/lib/devAuth';

export interface MentionUser {
  id: string;
  name: string;
  email: string;
  profile_picture_url?: string;
  profile_image?: string;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string, mentions: MentionUser[]) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  projectId: string;
  token: string;
  disabled?: boolean;
}

const MentionInput: React.FC<MentionInputProps> = ({
  value,
  onChange,
  placeholder = "Write a comment...",
  rows = 3,
  className = "",
  projectId,
  token,
  disabled = false
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<MentionUser[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [mentionQuery, setMentionQuery] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [mentions, setMentions] = useState<MentionUser[]>([]);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Fetch project members for suggestions
  const fetchProjectMembers = async (query: string = '') => {
    try {
      console.log('🔍 fetchProjectMembers called with:', { query, projectId, hasToken: !!token });
      
      if (!projectId || projectId === 'undefined' || projectId === 'null') {
        console.error('❌ Invalid projectId:', projectId);
        setSuggestions([]);
        return;
      }
      
      // Use dev auth header if no token provided (development mode)
      const authHeader = token ? `Bearer ${token}` : getDevAuthHeader();
      
      if (!authHeader) {
        console.warn('No auth token available for fetching project members');
        setSuggestions([]);
        return;
      }
      
      const response = await fetch(`/api/get-project-members/${projectId}`, {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('🔍 API Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('🔍 API Response data:', data);
        let members = data.members || [];
        
        // Filter by query if provided
        if (query) {
          members = members.filter((member: any) => 
            member.user.name.toLowerCase().includes(query.toLowerCase()) ||
            member.user.email.toLowerCase().includes(query.toLowerCase())
          );
        }
        
        // Convert to MentionUser format
        const mentionUsers: MentionUser[] = members.map((member: any) => ({
          id: member.user.id,
          name: member.user.name,
          email: member.user.email,
          profile_picture_url: member.user.profile_picture_url,
          profile_image: member.user.profile_image
        }));
        
        console.log('🔍 Converted mentionUsers:', mentionUsers);
        setSuggestions(mentionUsers);
      } else {
        console.error('🔍 API Request failed:', response.status, await response.text());
      }
    } catch (error) {
      console.error('Error fetching project members:', error);
      setSuggestions([]);
    }
  };

  // Handle textarea input
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const displayValue = e.target.value; // This is what user sees: "@Name"
    const cursor = e.target.selectionStart;
    setCursorPosition(cursor);

    // Convert existing mentions from stored format to display format to work with displayValue
    // We need to reconstruct the actual value with IDs by replacing @Name with @[Name](id)
    let actualValue = displayValue;
    
    // For existing mentions, we already have them stored
    mentions.forEach(mention => {
      const displayMention = `@${mention.name}`;
      const storedMention = `@[${mention.name}](${mention.id})`;
      actualValue = actualValue.replace(new RegExp(`@${mention.name}(?!\\])`, 'g'), storedMention);
    });

    // Check for @ mentions in display value
    const beforeCursor = displayValue.slice(0, cursor);
    const atIndex = beforeCursor.lastIndexOf('@');
    
    console.log('🔍 Mention detection:', { 
      displayValue,
      actualValue,
      beforeCursor, 
      atIndex, 
      cursor
    });
    
    if (atIndex !== -1) {
      const afterAt = beforeCursor.slice(atIndex + 1);
      console.log('🔍 After @ text:', afterAt);
      
      // Check if we're in a mention context (no spaces after @)
      if (!afterAt.includes(' ') && !afterAt.includes('\n')) {
        console.log('🔍 Showing suggestions for query:', afterAt);
        setMentionQuery(afterAt);
        setShowSuggestions(true);
        setSelectedSuggestion(0);
        fetchProjectMembers(afterAt);
      } else {
        console.log('🔍 Hiding suggestions - space/newline found');
        setShowSuggestions(false);
      }
    } else {
      console.log('🔍 No @ found - hiding suggestions');
      setShowSuggestions(false);
    }

    const extracted = extractMentions(actualValue);
    setMentions(extracted);
    onChange(actualValue, extracted);
  };

  // Helper to extract mentions
  const extractMentions = (text: string): MentionUser[] => {
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    const extractedMentions: MentionUser[] = [];
    let match;
    
    while ((match = mentionRegex.exec(text)) !== null) {
      const [, name, id] = match;
      const existingUser = mentions.find(m => m.id === id);
      if (existingUser) {
        extractedMentions.push(existingUser);
      }
    }
    
    return extractedMentions;
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedSuggestion((prev) => 
            prev < suggestions.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedSuggestion((prev) => 
            prev > 0 ? prev - 1 : suggestions.length - 1
          );
          break;
        case 'Enter':
        case 'Tab':
          e.preventDefault();
          selectSuggestion(selectedSuggestion);
          break;
        case 'Escape':
          setShowSuggestions(false);
          break;
      }
    }
  };

  // Select a suggestion
  const selectSuggestion = (index: number) => {
    if (suggestions[index]) {
      const suggestion = suggestions[index];
      const beforeCursor = value.slice(0, cursorPosition);
      const afterCursor = value.slice(cursorPosition);
      const atIndex = beforeCursor.lastIndexOf('@');
      
      // Replace @query with @[Name](id) format
      const beforeAt = beforeCursor.slice(0, atIndex);
      const mentionText = `@[${suggestion.name}](${suggestion.id})`;
      const newValue = beforeAt + mentionText + ' ' + afterCursor;
      
      // Update mentions list
      const updatedMentions = [...mentions];
      if (!updatedMentions.find(m => m.id === suggestion.id)) {
        updatedMentions.push(suggestion);
      }
      
      setMentions(updatedMentions);
      setShowSuggestions(false);
      onChange(newValue, updatedMentions);
      
      // Set cursor position after mention
      setTimeout(() => {
        if (textareaRef.current) {
          const newPosition = beforeAt.length + mentionText.length + 1;
          textareaRef.current.setSelectionRange(newPosition, newPosition);
          textareaRef.current.focus();
        }
      }, 0);
    }
  };

  // Get display text (convert mentions to readable format)
  const getDisplayText = (text: string) => {
    return text.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1');
  };

  // Calculate suggestion position at cursor
  const getSuggestionPosition = () => {
    if (!textareaRef.current) return {};
    
    const textarea = textareaRef.current;
    const textBeforeCursor = value.substring(0, cursorPosition);
    const lines = textBeforeCursor.split('\n');
    const currentLineNumber = lines.length;
    const lineHeight = 24; // Approximate line height in pixels
    const padding = 12; // Textarea padding
    
    // Position dropdown below current line
    const top = (currentLineNumber * lineHeight) + padding;
    
    return {
      top: `${top}px`,
      left: '12px',
      maxWidth: 'calc(100% - 24px)',
    };
  };

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={getDisplayText(value)}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        className={`w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none ${className}`}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
      />
      
      {/* Suggestions dropdown - positioned absolutely within parent, does not expand it */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-9999 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto min-w-[250px]"
          style={getSuggestionPosition()}
        >
          {suggestions.map((suggestion, index) => (
            <div
              key={suggestion.id}
              className={`flex items-center space-x-3 p-3 cursor-pointer ${
                index === selectedSuggestion ? 'bg-blue-50 border-l-2 border-blue-500' : 'hover:bg-gray-50'
              }`}
              onClick={() => selectSuggestion(index)}
            >
              {/* Avatar */}
              <div className="shrink-0">
                {suggestion.profile_picture_url || suggestion.profile_image ? (
                  <img
                    src={suggestion.profile_picture_url || suggestion.profile_image}
                    alt={suggestion.name}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-gray-600" />
                  </div>
                )}
              </div>
              
              {/* User info */}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900">{suggestion.name}</div>
                <div className="text-sm text-gray-500 truncate">{suggestion.email}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MentionInput;