import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import ClientProviders from "@/components/ClientProviders";

export const metadata: Metadata = {
  title: "SocialNet",
  description: "A modern social network",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClientProviders>
          <Navbar />
          <div style={{ paddingTop: "var(--navbar-h)" }}>
            {children}
          </div>
        </ClientProviders>
      </body>
    </html>
  );
}
