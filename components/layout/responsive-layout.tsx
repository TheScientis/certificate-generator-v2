'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from './sidebar';
import { MainContent } from './main-content';
import { IEvent } from '@/lib/types';
import { DatabaseHealthCheck } from '../database';
import { IView } from '@/lib/types';
import { useMediaQuery } from '@/hooks/use-media-query';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '../sidebar/logo';

interface ResponsiveLayoutProps {
  events: IEvent[];
  selectedEvent: IEvent | null;
  onEventSelect: (event: IEvent) => void;
  onEventCreate: () => void;
  onEventUpdate: (event: IEvent) => void;
  onEventEdit?: (event: IEvent) => void;
  onEventsChange?: () => void;
  currentView: IView;
  onViewChange: (view: IView) => void;
  children?: React.ReactNode;
}

export function ResponsiveLayout({
  events,
  selectedEvent,
  onEventSelect,
  onEventCreate,
  onEventUpdate,
  onEventEdit,
  onEventsChange,
  currentView,
  onViewChange,
  children,
}: ResponsiveLayoutProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const environment = process.env.NEXT_PUBLIC_ENVIRONMENT;

  // Close mobile menu when switching to desktop
  useEffect(() => {
    if (isDesktop) {
      setIsMobileMenuOpen(false);
    }
  }, [isDesktop]);

  const filteredEvents = events.filter(
    (event) =>
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleMobileEventSelect = (event: IEvent) => {
    onEventSelect(event);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {/* Mobile Top Navbar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-40 flex items-center justify-between px-4">
        <Logo />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </Button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && !isDesktop && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') {
              setIsMobileMenuOpen(false);
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Close sidebar menu"
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed md:relative z-50 h-full
          transition-all duration-300 ease-in-out
          bg-white dark:bg-gray-800
          border-r border-gray-200 dark:border-gray-700
          flex flex-col
          ${isDesktop 
            ? (isSidebarCollapsed ? 'w-16' : 'w-80') 
            : (isMobileMenuOpen ? 'translate-x-0 w-[85vw] max-w-[320px]' : '-translate-x-full w-[85vw] max-w-[320px]')
          }
        `}
      >
        <Sidebar
          events={filteredEvents}
          selectedEvent={selectedEvent}
          onEventSelect={isDesktop ? onEventSelect : handleMobileEventSelect}
          onEventCreate={() => {
            onEventCreate();
            setIsMobileMenuOpen(false);
          }}
          onEventEdit={(e) => {
            onEventEdit?.(e);
            setIsMobileMenuOpen(false);
          }}
          onEventsChange={onEventsChange}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isCollapsed={isDesktop ? isSidebarCollapsed : false}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          currentView={currentView}
          onViewChange={(view) => {
            onViewChange(view);
            setIsMobileMenuOpen(false);
          }}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden pt-16 md:pt-0 w-full">
        <MainContent
          selectedEvent={selectedEvent}
          onEventUpdate={onEventUpdate}
        >
          {children}
        </MainContent>

        {/* Database Health Check */}
        <div
          className="absolute bottom-2 right-2"
          hidden={environment && environment == 'Development' ? false : true}
        >
          <DatabaseHealthCheck />
        </div>
      </div>
    </div>
  );
}
