import React from "react";
import { GITHUB_REPO_URL, DOWNLOAD_URL, DOWNLOAD_MICROCOPY } from "@/lib/constants";
import { KeycapButton } from "@/components/ui/KeycapButton";
import { StickerCard } from "@/components/ui/StickerCard";
import { TagBadge } from "@/components/ui/TagBadge";

export const Hero: React.FC = () => {
  return (
    <section className="relative pt-12 pb-16 md:pt-20 md:pb-24 overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column: Pitch & CTA */}
          <div className="lg:col-span-7 flex flex-col items-start text-left">
            <div className="mb-4">
              <TagBadge rotation="-rotate-2">DESKTOP BUDDY</TagBadge>
            </div>

            <h1 className="font-display font-black text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-[1.08] text-text text-balance">
              a tiny water reminder that actually gets out of your way.
            </h1>

            <p className="mt-5 text-base sm:text-lg lg:text-xl text-muted leading-relaxed max-w-xl">
              DrinkUp lives in your Windows tray, splashes a reminder onto your
              screen when it&apos;s time to sip, and dives back out. No accounts,
              no subscriptions, no nagging popups you have to fight with — just
              one tiny .exe.
            </p>

            {/* Actions */}
            <div className="mt-8 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
              <KeycapButton href={DOWNLOAD_URL} download="DrinkUp-Setup.exe" size="lg">
                <span>⬇</span>
                <span>Download DrinkUp for Windows</span>
              </KeycapButton>

              <a
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-display font-bold text-sm sm:text-base text-muted hover:text-text transition-colors flex items-center gap-1.5 group py-2"
              >
                <span>View on GitHub</span>
                <span className="group-hover:translate-x-1 transition-transform">
                  →
                </span>
              </a>
            </div>

            {/* Microcopy */}
            <div className="mt-4 flex items-center gap-2 text-xs font-label text-muted">
              <span>{DOWNLOAD_MICROCOPY}</span>
            </div>
          </div>

          {/* Right Column: Screenshot in StickerCard with overlapping TagBadge */}
          <div className="lg:col-span-5 relative w-full max-w-md mx-auto lg:max-w-none">
            {/* Slanted Tag Badge overlapping card */}
            <div className="relative z-20 -mb-3 ml-6 sm:ml-8">
              <TagBadge rotation="-rotate-3">DRIPPY SAYS</TagBadge>
            </div>

            {/* Sticker Card container */}
            <StickerCard
              tone="card"
              className="hover:scale-[1.01] transition-transform duration-300"
              innerClassName="!p-2.5 sm:!p-3.5 bg-sheet/40"
            >
              <div className="relative w-full rounded-2xl overflow-hidden shadow-inner border border-line/50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/reminder-light.png"
                  alt="A DrinkUp reminder: Drippy the water-drop buddy next to a blue sticker-style speech bubble that says 'water break, bestie' with an 'i drank' button and a 'not rn' link"
                  className="w-full h-auto object-cover rounded-xl select-none"
                  loading="eager"
                />
              </div>
            </StickerCard>
          </div>
        </div>
      </div>
    </section>
  );
};
