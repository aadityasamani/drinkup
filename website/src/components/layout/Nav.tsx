import React from "react";
import Image from "next/image";
import { GITHUB_REPO_URL, DOWNLOAD_URL } from "@/lib/constants";
import { KeycapButton } from "@/components/ui/KeycapButton";

export const Nav: React.FC = () => {
  return (
    <header className="sticky top-0 z-50 w-full bg-sheet/85 backdrop-blur-md border-b border-line transition-colors duration-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo & Wordmark */}
        <a
          href="#"
          className="flex items-center gap-2.5 group transition-transform duration-150 hover:scale-[1.02]"
        >
          <div className="relative w-8 h-8 rounded-xl overflow-hidden p-0.5 bg-dieCut shadow-sm">
            <Image
              src="/icon.png"
              alt="DrinkUp Logo"
              width={32}
              height={32}
              className="w-full h-full object-contain"
              priority
            />
          </div>
          <span className="font-display font-extrabold text-xl sm:text-2xl tracking-tight text-text">
            DrinkUp
          </span>
        </a>

        {/* Links */}
        <nav className="flex items-center gap-3 sm:gap-6">
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-bold text-muted hover:text-text transition-colors duration-150 px-2 py-1"
          >
            GitHub
          </a>
          <KeycapButton href={DOWNLOAD_URL} download="DrinkUp-Setup.exe" size="sm">
            <span>⬇</span>
            <span>Download</span>
          </KeycapButton>
        </nav>
      </div>
    </header>
  );
};
