/**
 * page.tsx
 * 
 * Main entry point for the Signal Clone application.
 * Renders the primary chat interface.
 */
'use client';

import ChatLayout from '@/components/ChatLayout';

/**
 * Home Component
 * 
 * Serves as the root UI component, wrapping the main chat layout in a full-screen container.
 * @returns The main application view.
 */
export default function Home() {
  return (
    <main className="h-screen w-screen overflow-hidden bg-[#111215]">
      <ChatLayout />
    </main>
  );
}
