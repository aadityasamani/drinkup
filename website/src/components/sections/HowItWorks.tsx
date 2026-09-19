import React from "react";
import { StickerCard } from "@/components/ui/StickerCard";

interface Step {
  step: string;
  title: string;
  desc: string;
}

const steps: Step[] = [
  {
    step: "01",
    title: "timer fires",
    desc: "Your chosen countdown finishes quietly in the background.",
  },
  {
    step: "02",
    title: "buddy springs out",
    desc: "A water drop plunges onto the screen with a satisfying splash.",
  },
  {
    step: "03",
    title: "bubble slaps on",
    desc: "The sticker speech bubble pops up encouraging you to drink.",
  },
  {
    step: "04",
    title: "you decide",
    desc: "Click 'i drank' to log hydration or 'not rn' to snooze.",
  },
  {
    step: "05",
    title: "dives back in",
    desc: "Drippy vanishes into the tray and your timer resets clean.",
  },
];

export const HowItWorks: React.FC = () => {
  return (
    <section id="how-it-works" className="py-16 md:py-24 transition-colors duration-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
          <h2 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl tracking-tight text-text">
            how it works
          </h2>
          <p className="mt-3 text-base sm:text-lg text-muted">
            no accounts. no setup wizard. just a drop that falls right on
            schedule.
          </p>
        </div>

        {/* 5-step sequence wrapped in a pool StickerCard */}
        <StickerCard
          tone="pool"
          className="w-full"
          innerClassName="!p-6 sm:!p-10 md:!p-12 text-onPool"
        >
          <div className="relative">
            {/* Desktop horizontal connector line */}
            <div className="hidden lg:block absolute top-7 left-12 right-12 h-0.5 bg-white/25 z-0" />

            {/* Mobile/Tablet vertical connector line */}
            <div className="lg:hidden absolute top-6 bottom-6 left-6 w-0.5 bg-white/25 z-0" />

            {/* Step items */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-4 relative z-10">
              {steps.map((item, idx) => (
                <div
                  key={item.step}
                  className="flex lg:flex-col items-start lg:items-center text-left lg:text-center gap-4 lg:gap-3 group"
                >
                  {/* Step Badge */}
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-dieCut text-pool font-label font-bold text-sm flex items-center justify-center shadow-md border-2 border-fizz transition-transform group-hover:scale-110">
                    {item.step}
                  </div>

                  {/* Step Content */}
                  <div className="pt-1 lg:pt-2">
                    <h3 className="font-display font-black text-lg sm:text-xl text-onPool tracking-tight capitalize">
                      {item.title}
                    </h3>
                    <p className="mt-1.5 text-xs sm:text-sm text-onPoolSoft leading-relaxed max-w-xs lg:max-w-none">
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </StickerCard>
      </div>
    </section>
  );
};
