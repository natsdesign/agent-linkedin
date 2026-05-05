import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { ToastProvider } from "@/components/ui/Toast";

export const metadata: Metadata = {
  title: "Content Agent",
  description: "AI-powered LinkedIn content creation platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="flex h-screen overflow-hidden bg-gray-950">
        <ToastProvider>
          <Sidebar />
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </ToastProvider>
      </body>
    </html>
  );
}
