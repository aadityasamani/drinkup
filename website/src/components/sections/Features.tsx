import React from "react";
import { StickerCard } from "@/components/ui/StickerCard";

interface Feature {
  emoji: string;
  title: string;
  description: string;
  tag?: string;
}

const features: Feature[] = [
  {
    emoji: "💦",
    title: "Splash-in reminders",
    description:
      "When it's time to drink, your water-drop buddy drops onto your screen with a playful splash sound and a speech bubble.",
    tag: "ANIMATED",
  },
  {
    emoji: "⏱️",
    title: "Live countdown & intervals",
    description:
      "Pick 15, 30, 45, or 60 minutes — or customize your pace. Track the exact countdown right from the settings card.",
    tag: "FLEXIBLE",
  },
  {
    emoji: "🎭",
    title: "Your character & sprite",
    description:
      "Stick with classic Drippy or upload your own PNG/GIF avatar to make the reminder uniquely yours.",
    tag: "CUSTOMIZABLE",
  },
  {
    emoji: "🌙",
    title: "Themes that match you",
    description:
      "Vibrant light mode, sleek midnight dark mode, or follow Windows system appearance seamlessly.",
    tag: "AUTO-THEME",
  },
  {
    emoji: "📌",
    title: "Always on top, tray-first",
    description:
      "Lives quietly in your Windows notification tray without cluttering your taskbar, springing up only when needed.",
    tag: "LIGHTWEIGHT",
  },
  {
    emoji: "🚀",
    title: "Auto-startup, audio & pause",
    description:
      "Launches on boot, plays soothing droplet audio cues, and lets you pause anytime you need uninterrupted focus.",
    tag: "NATIVE",
  },
];

export const Features: React.FC = () => {
  return (
    <section id="features" className="py-16 md:py-24 transition-colors duration-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
          <h2 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl tracking-tight text-text">
            everything it does. nothing it doesn&apos;t.
          </h2>
          <p className="mt-3 text-base sm:text-lg text-muted">
            nine small things that add up to one buddy who never lets you forget.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feat) => (
            <StickerCard
              key={feat.title}
              tone="card"
              className="hover:-translate-y-1 hover:shadow-lg transition-all duration-200"
              innerClassName="flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-3xl select-none" role="img" aria-label={feat.title}>
                    {feat.emoji}
                  </span>
                  {feat.tag && (
                    <span className="font-label text-[10px] font-bold tracking-wider uppercase text-muted bg-sheet px-2 py-0.5 rounded-full border border-line">
                      {feat.tag}
                    </span>
                  )}
                </div>
                <h3 className="font-display font-bold text-xl text-text mb-2 tracking-tight">
                  {feat.title}
                </h3>
                <p className="text-sm text-muted leading-relaxed">
                  {feat.description}
                </p>
              </div>
            </StickerCard>
          ))}
        </div>
      </div>
    </section>
  );
};
