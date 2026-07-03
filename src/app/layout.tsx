import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { DataProvider } from "@/components/DataProvider";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Amal & Company — Marketing Analytics",
  description:
    "Unified executive analytics platform: pipeline, outreach, webinars, content, and campaigns — live from Airtable.",
};

// Apply the persisted theme before first paint to avoid a flash.
const themeInit = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        <Suspense fallback={null}>
          <DataProvider>
            <AppShell>{children}</AppShell>
          </DataProvider>
        </Suspense>
      </body>
    </html>
  );
}
