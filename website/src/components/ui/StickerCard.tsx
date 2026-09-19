import React from "react";

interface StickerCardProps {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
  tone?: "pool" | "card" | "subtle";
  animate?: boolean;
}

export const StickerCard: React.FC<StickerCardProps> = ({
  children,
  className = "",
  innerClassName = "",
  tone = "card",
  animate = false,
}) => {
  const toneClasses = {
    pool: "bg-pool text-onPool",
    card: "bg-card text-text border border-line/40",
    subtle: "bg-sheet text-text border border-line/60",
  }[tone];

  return (
    <div
      className={`relative p-1 rounded-[24px] bg-dieCut shadow-sticker transition-transform duration-200 ${
        animate ? "animate-slap" : ""
      } ${className}`}
    >
      <div
        className={`relative z-10 w-full h-full rounded-[20px] p-5 sm:p-6 transition-colors duration-200 ${toneClasses} ${innerClassName}`}
      >
        {children}
      </div>
    </div>
  );
};
