import React from "react";
import { Nav } from "@/components/layout/Nav";
import { Hero } from "@/components/sections/Hero";
import { Features } from "@/components/sections/Features";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { DownloadCta } from "@/components/sections/DownloadCta";
import { Footer } from "@/components/layout/Footer";

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Nav />
      <main className="flex-1">
        <Hero />
        <Features />
        <HowItWorks />
        <DownloadCta />
      </main>
      <Footer />
    </div>
  );
}
