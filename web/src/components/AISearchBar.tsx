"use client";

import { useState, useRef, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

interface SearchResult {
  id: string;
  type: 'lead' | 'opportunity' | 'task' | 'setting' | 'navigation';
  title: string;
  subtitle?: string;
  description?: string;
  action: {
    type: 'navigate' | 'modal' | 'function';
    target: string;
    params?: Record<string, any>;
  };
  score?: number;
}

interface SearchResponse {
  results: SearchResult[];
  directAnswer?: string;
  suggestedAction?: {
    label: string;
    action: SearchResult['action'];
  };
}

export default function AISearchBar() {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Ensure component is mounted before enabling functionality
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Click outside to close
  useEffect(() => {
    if (!isMounted) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, isMounted]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isMounted) return;
    
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd/Ctrl + K to focus search
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      
      // Escape to close
      if (event.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMounted]);

  const handleSearch = async (searchQuery: string) => {
    if (!isMounted || !searchQuery.trim()) {
      setResults(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiFetch<SearchResponse>('/ai/search', {
        method: 'POST',
        json: { query: searchQuery }
      });
      
      setResults(response);
    } catch (err: any) {
      console.error('Search error:', err);
      setError(err.message || 'Search failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isMounted) return;
    
    const value = e.target.value;
    setQuery(value);
  };

  // Debounced search effect
  useEffect(() => {
    if (!isMounted || !query.trim()) {
      setResults(null);
      return;
    }

    const timeoutId = setTimeout(() => {
      handleSearch(query);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, isMounted]);

  const executeAction = async (action: SearchResult['action'], result?: SearchResult) => {
    if (!isMounted) return;
    
    setIsOpen(false);
    setQuery("");
    setResults(null);

    try {
      switch (action.type) {
        case 'navigate':
          router.push(action.target);
          break;
          
        case 'modal':
          // For modal actions, we'll navigate to the page with URL params
          if (action.params) {
            const url = new URL(action.target, window.location.origin);
            Object.entries(action.params).forEach(([key, value]) => {
              url.searchParams.set(key, String(value));
            });
            router.push(url.pathname + url.search);
          } else {
            router.push(action.target);
          }
          break;
          
        case 'function':
          // For function actions like settings changes
          await apiFetch(action.target, {
            method: 'POST',
            json: action.params || {}
          });
          
          // Show success message or navigate to relevant page
          if (result?.description?.includes('year end')) {
            router.push('/dashboard?tab=settings&section=financial');
          }
          break;
          
        default:
          console.warn('Unknown action type:', action.type);
      }
    } catch (err: any) {
      console.error('Action execution error:', err);
      setError(err.message || 'Action failed');
      
      // Show error briefly then clear it
      setTimeout(() => setError(null), 3000);
    }
  };

  const getResultIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'lead':
        return '👤';
      case 'opportunity':
        return '💰';
      case 'task':
        return '✓';
      case 'setting':
        return '⚙️';
      case 'navigation':
        return '🧭';
      default:
        return '🔍';
    }
  };

  const getResultTypeLabel = (type: SearchResult['type']) => {
    switch (type) {
      case 'lead':
        return 'Lead';
      case 'opportunity':
        return 'Opportunity';
      case 'task':
        return 'Task';
      case 'setting':
        return 'Setting';
      case 'navigation':
        return 'Navigate';
      default:
        return 'Result';
    }
  };

  return (
    <div className="relative flex-1 max-w-2xl" ref={searchRef}>
      {/* Search Input */}
      <div className="relative">
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => isMounted && setIsOpen(true)}
          placeholder={isMounted ? "Search anything or ask Joinery AI... (⌘K)" : "Search..."}
          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-full bg-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={!isMounted}
        />
        {isLoading && isMounted && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
          </div>
        )}
      </div>

      {/* Search Results Dropdown */}
      {isMounted && isOpen && (query.trim() || results || error) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          {error && (
            <div className="p-4 text-red-600 text-sm">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            </div>
          )}

          {results?.directAnswer && (
            <div className="p-4 bg-blue-50 border-b border-gray-200">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                  AI
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-700">{results.directAnswer}</p>
                  {results.suggestedAction && (
                    <Button
                      size="sm"
                      className="mt-2"
                      onClick={() => executeAction(results.suggestedAction!.action)}
                    >
                      {results.suggestedAction.label}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {results?.results && results.results.length > 0 && (
            <div className="p-2">
              <div className="text-xs font-medium text-gray-500 px-2 py-1">
                Search Results ({results.results.length})
              </div>
              {results.results.map((result, index) => (
                <button
                  key={`${result.type}-${result.id}-${index}`}
                  onClick={() => executeAction(result.action, result)}
                  className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 focus:outline-none focus:bg-gray-50 text-left transition-colors"
                >
                  <div className="flex-shrink-0 text-lg">
                    {getResultIcon(result.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 truncate">{result.title}</span>
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                        {getResultTypeLabel(result.type)}
                      </span>
                    </div>
                    {result.subtitle && (
                      <p className="text-sm text-gray-600 truncate mt-0.5">{result.subtitle}</p>
                    )}
                    {result.description && (
                      <p className="text-xs text-gray-500 line-clamp-2 mt-1">{result.description}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!isLoading && query.trim() && (!results?.results || results.results.length === 0) && !error && (
            <div className="p-4 text-center text-gray-500 text-sm">
              <div className="flex flex-col items-center gap-2">
                <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p>No results found for "{query}"</p>
                <p className="text-xs">Try searching for leads, opportunities, or asking a question.</p>
              </div>
            </div>
          )}

          {!query.trim() && (
            <div className="p-4 text-sm text-gray-500">
              <div className="space-y-2">
                <p className="font-medium">Try searching for:</p>
                <ul className="space-y-1 text-xs">
                  <li>• "Erin Woodger" - Find leads or opportunities</li>
                  <li>• "How do I set my year end?" - Get help with settings</li>
                  <li>• "Show me my tasks" - Navigate to your tasks</li>
                  <li>• "What are my sales this month?" - Get analytics</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}