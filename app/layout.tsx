import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { HydrateStore } from "./store/HydrateStore";
import { ThemeProvider } from "./providers/ThemeProvider";
import MainLayout from "@/components/ui/MainLayout";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ticketing Metrix - Support & Project Management",
  description: "Streamline your support workflow with our powerful ticketing system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors`}
      >
        <ThemeProvider>
          <HydrateStore>
            <MainLayout>
              {children}
            </MainLayout>
          </HydrateStore>
        </ThemeProvider>
      </body>
    </html>
  );
}
