import React from "react";
import { GITHUB_REPO_URL, LICENSE_URL, AUTHOR_URL } from "@/lib/constants";

export const Footer: React.FC = () => {
  return (
    <footer className="w-full border-t border-line/60 py-12 px-4 sm:px-6 transition-colors duration-200">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted">
          <span>
            © 2026 DrinkUp.{" "}
            <a
              href={LICENSE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-text transition-colors"
            >
              MIT licensed
            </a>
            .
          </span>
          <span className="hidden sm:inline text-line">•</span>
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-text transition-colors"
          >
            GitHub
          </a>
          <span className="hidden sm:inline text-line">•</span>
          <span>
            made by{" "}
            <a
              href={AUTHOR_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-text hover:underline transition-colors"
            >
              Aaditya Samani
            </a>
          </span>
        </div>

        <div className="text-xs font-label text-muted/80 tracking-wide">
          Built with Tauri.
        </div>
      </div>
    </footer>
  );
};
