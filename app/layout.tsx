import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { HydrateStore } from "./store/HydrateStore";
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
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <HydrateStore>
          <MainLayout>
            {children}
          </MainLayout>
        </HydrateStore>
        
      </body>
    </html>
  );
}
