'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { ResponsiveLayout } from '@/components/layout/responsive-layout';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { IEvent } from '@/lib/types';
import { getAllEventsSummary, getEvent } from '@/lib/actions';
import {
  saveAppState,
  loadAppState,
  findEventById,
} from '@/lib/local-storage-utils';
import { IView, viewList } from '@/lib/types';

// Lazy load components for code splitting
const EventCreationTab = dynamic(
  () => import('@/components/event-creation-tab').then((mod) => ({ default: mod.EventCreationTab })),
  { 
    loading: () => (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }
);

const TemplateUploadSection = dynamic(
  () => import('@/components/template-upload-section').then((mod) => ({ default: mod.TemplateUploadSection })),
  { 
    loading: () => (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }
);

const TemplateAdjustmentSection = dynamic(
  () => import('@/components/template-adjustment/template-adjustment-section').then((mod) => ({ default: mod.TemplateAdjustmentSection })),
  { 
    loading: () => (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }
);

const ParticipantManagerSection = dynamic(
  () => import('@/components/participant-manager/participant-manager-section').then((mod) => ({ default: mod.ParticipantManagerSection })),
  { 
    loading: () => (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }
);

const EmailStatusDashboard = dynamic(
  () => import('@/components/email').then((mod) => ({ default: mod.EmailStatusDashboard })),
  { 
    loading: () => (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }
);

const EmailConfigView = dynamic(
  () => import('@/components/email').then((mod) => ({ default: mod.EmailConfigView })),
  { 
    loading: () => (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }
);

export default function Home() {
  const [events, setEvents] = useState<IEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<IEvent | null>(null);
  const [currentView, setCurrentView] = useState<IView>(viewList.create);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load full event data when selected event changes
  useEffect(() => {
    const loadFullEventData = async () => {
      if (!selectedEvent?._id) return;
      
      // Check if we already have full data (has base64 or participants)
      if (selectedEvent.template.base64 || selectedEvent.participants.length > 0) {
        return; // Already have full data
      }

      try {
        const fullEvent = await getEvent(selectedEvent._id.toString());
        if (fullEvent) {
          setSelectedEvent(fullEvent);
          // Update in events list too
          setEvents((prev) =>
            prev.map((e) => (e._id === fullEvent._id ? fullEvent : e))
          );
        }
      } catch (err) {
        console.error('Error loading full event data:', err);
      }
    };

    loadFullEventData();
  }, [selectedEvent?._id]);

  // Load events and restore state on component mount
  useEffect(() => {
    const initializeApp = async () => {
      try {
        setLoading(true);

        // Load event summaries (without base64 and participants) for faster initial load
        const eventSummaries = await getAllEventsSummary();
        setEvents(eventSummaries);

        // Try to restore previous state
        const savedState = loadAppState();
        if (savedState) {
          // Restore view
          if (Object.values(viewList).includes(savedState.currentView)) {
            setCurrentView(savedState.currentView as IView);
          }

          // Restore selected event if it still exists
          if (savedState.selectedEventId) {
            const event = findEventById(eventSummaries, savedState.selectedEventId);
            if (event) {
              setSelectedEvent(event);
              // Load full event data in background
              getEvent(savedState.selectedEventId)
                .then((fullEvent) => {
                  if (fullEvent) {
                    setSelectedEvent(fullEvent);
                    setEvents((prev) =>
                      prev.map((e) => (e._id === fullEvent._id ? fullEvent : e))
                    );
                  }
                })
                .catch((err) => {
                  console.error('Error loading full event data:', err);
                });
            }
          }
        }
      } catch (err) {
        console.error('Error initializing app:', err);
        setError('Failed to load events');
      } finally {
        setLoading(false);
      }
    };

    initializeApp();
  }, []);

  const loadEvents = async () => {
    try {
      setLoading(true);
      // Use summary for faster refresh
      const eventSummaries = await getAllEventsSummary();
      setEvents(eventSummaries);
      
      // If we have a selected event, refresh its full data
      if (selectedEvent?._id) {
        const fullEvent = await getEvent(selectedEvent._id.toString());
        if (fullEvent) {
          setSelectedEvent(fullEvent);
          setEvents((prev) =>
            prev.map((e) => (e._id === fullEvent._id ? fullEvent : e))
          );
        }
      }
    } catch (err) {
      console.error('Error loading events:', err);
      setError('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const navigateView = (view: IView) => {
    console.log('Navigating to view:', view);
    setCurrentView(view);
    // Persist view change
    saveAppState({
      currentView: view as string,
      selectedEventId: selectedEvent?._id?.toString() || null,
    });
  };

  const handleEventCreated = (event: IEvent) => {
    setEvents((prev) => [event, ...prev]);
    setSelectedEvent(event);
    navigateView(viewList.template);
  };

  const handleEventSelected = async (event: IEvent) => {
    setSelectedEvent(event);
    // Persist selected event
    saveAppState({
      currentView: currentView as string,
      selectedEventId: event._id?.toString() || null,
    });
    
    // Load full event data if we only have summary
    if (!event.template.base64 && event._id) {
      try {
        const fullEvent = await getEvent(event._id.toString());
        if (fullEvent) {
          setSelectedEvent(fullEvent);
          setEvents((prev) =>
            prev.map((e) => (e._id === fullEvent._id ? fullEvent : e))
          );
          // Use full event for navigation check
          navigateView(viewList.template);
          return;

        }
      } catch (err) {
        console.error('Error loading full event data:', err);
      }
    }
    
    // If event has template, go to layout section, otherwise go to template upload
    if (event.template.base64) {
      navigateView(viewList.template);
    } else {
      navigateView(viewList.template);
    }
  };

  const handleEventUpdate = (event: IEvent) => {
    setEvents((prev) => prev.map((e) => (e._id === event._id ? event : e)));
    setSelectedEvent(event);
    // Persist updated event selection
    saveAppState({
      currentView: currentView as string,
      selectedEventId: event._id?.toString() || null,
    });
  };

  const handleEventEdit = (event: IEvent) => {
    setSelectedEvent(event);
    // Persist selected event
    saveAppState({
      currentView: currentView as string,
      selectedEventId: event._id?.toString() || null,
    });
    navigateView(viewList.template);
  };

  const handleEventsChange = () => {
    loadEvents(); // Refresh events list
  };

  const handleEventCreate = () => {
    navigateView(viewList.create);
  };

  const handleTemplateUploaded = () => {
    loadEvents(); // Refresh to get updated event
    navigateView(viewList.layout);
  };

  const handleLayoutConfigured = () => {
    loadEvents(); // Refresh to get updated event
    navigateView(viewList.recipients);
  };

  const handleParticipantsUploaded = () => {
    loadEvents(); // Refresh to get updated event
    // setCurrentView('generate');
  };

  // Back navigation handlers
  const handleBackToTemplate = () => {
    navigateView(viewList.template);
  };

  const handleBackToLayout = () => {
    navigateView(viewList.layout);
  };

  const canGenerate =
    selectedEvent &&
    selectedEvent.template.base64 &&
    selectedEvent.participants.length > 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading events...</p>
        </div>
      </div>
    );
  }

  return (
    <ResponsiveLayout
      events={events}
      selectedEvent={selectedEvent}
      onEventSelect={handleEventSelected}
      onEventCreate={handleEventCreate}
      onEventUpdate={handleEventUpdate}
      onEventEdit={handleEventEdit}
      onEventsChange={handleEventsChange}
      currentView={currentView as IView}
      onViewChange={navigateView}
    >
      {error && (
        <Alert className="mb-6 border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20">
          <AlertDescription className="text-red-800 dark:text-red-200">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content Views */}
      {currentView === viewList.create && (
        <EventCreationTab onEventCreated={handleEventCreated} />
      )}

      {currentView === viewList.template && selectedEvent && (
        <TemplateUploadSection
          event={selectedEvent}
          onTemplateUploaded={handleTemplateUploaded}
          onBack={handleEventCreate}
        />
      )}

      {currentView === viewList.layout && selectedEvent && (
        <TemplateAdjustmentSection
          event={selectedEvent}
          onContinue={handleLayoutConfigured}
          onBack={handleBackToTemplate}
        />
      )}

      {currentView === viewList.recipients && selectedEvent && (
        <ParticipantManagerSection
          event={selectedEvent}
          onParticipantsUploaded={handleParticipantsUploaded}
          onBack={handleBackToLayout}
        />
      )}

      {currentView === viewList.email && selectedEvent && (
        <EmailStatusDashboard
          eventId={selectedEvent._id!.toString()}
          participants={selectedEvent.participants}
          onEmailRetry={handleParticipantsUploaded}
        />
      )}

      {currentView === viewList.emailConfig && selectedEvent && (
        <EmailConfigView
          event={selectedEvent}
          onBack={() => navigateView(viewList.recipients)}
          onConfigUpdate={() => loadEvents()}
        />
      )}

      {/* No Event Selected State */}
      {!selectedEvent && currentView !== viewList.create && (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            No Event Selected
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Please select an event from the sidebar to continue.
          </p>
        </div>
      )}
    </ResponsiveLayout>
  );
}
