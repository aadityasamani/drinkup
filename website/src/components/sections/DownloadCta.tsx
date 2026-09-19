import React from "react";
import {
  GITHUB_REPO_URL,
  DOWNLOAD_URL,
  DOWNLOAD_MICROCOPY_FULL,
} from "@/lib/constants";
import { StickerCard } from "@/components/ui/StickerCard";
import { KeycapButton } from "@/components/ui/KeycapButton";
import { OutlinePillButton } from "@/components/ui/OutlinePillButton";

export const DownloadCta: React.FC = () => {
  return (
    <section id="download" className="py-16 md:py-24 transition-colors duration-200">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <StickerCard
          tone="pool"
          className="text-center"
          innerClassName="!py-12 sm:!py-16 !px-6 sm:!px-12 flex flex-col items-center"
        >
          <h2 className="font-display font-black text-3xl sm:text-4xl lg:text-5xl text-onPool tracking-tight text-balance">
            okay, bestie. let&apos;s get you hydrated.
          </h2>

          <p className="mt-4 text-base sm:text-lg text-onPoolSoft max-w-xl text-balance">
            one tiny installer. no bloat, no subscriptions, no accounts to make.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center gap-4">
            <KeycapButton href={DOWNLOAD_URL} download="DrinkUp-Setup.exe" size="lg">
              <span>⬇</span>
              <span>Download DrinkUp for Windows</span>
            </KeycapButton>

            <OutlinePillButton
              href={`${GITHUB_REPO_URL}/releases`}
              variant="on-pool"
              target="_blank"
            >
              Browse releases on GitHub →
            </OutlinePillButton>
          </div>

          <div className="mt-5 text-xs font-label text-onPoolSoft tracking-wide">
            {DOWNLOAD_MICROCOPY_FULL}
          </div>
        </StickerCard>
      </div>
    </section>
  );
};
