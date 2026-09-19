import React from "react";

interface TagBadgeProps {
  children: React.ReactNode;
  className?: string;
  rotation?: string;
}

export const TagBadge: React.FC<TagBadgeProps> = ({
  children,
  className = "",
  rotation = "-rotate-3",
}) => {
  return (
    <span
      className={`
        inline-block font-label text-[10.5px] font-bold tracking-[0.08em] uppercase
        bg-bubblegum text-ink px-3 py-1 rounded-full
        shadow-[0_0_0_3px_var(--die-cut)] select-none
        transition-transform duration-200 hover:rotate-0
        ${rotation}
        ${className}
      `}
    >
      {children}
    </span>
  );
};
