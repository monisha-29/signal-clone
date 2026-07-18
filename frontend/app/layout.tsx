/**
 * layout.tsx
 * 
 * Root layout for the Next.js application. Handles global styles,
 * metadata, and theme initialization (dark mode).
 */
import type { Metadata } from "next";
import "./globals.css";

/**
 * Application metadata for SEO and browser tabs.
 */
export const metadata: Metadata = {
  title: "Signal Messenger | Private Messenger",
  description: "Signal Messenger Clone - Secure, Private real-time messaging",
};

/**
 * RootLayout Component
 * 
 * Wraps all pages. Injects a script to prevent dark-mode flash during hydration.
 * 
 * @param children - The child components to render within the layout.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        {/* Inline script to prevent theme flash on hydration by checking localStorage */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('theme');document.documentElement.classList.toggle('dark',s?s==='dark':true);}catch(e){document.documentElement.classList.add('dark');}})();`,
          }}
        />
      </head>
      <body className="h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
