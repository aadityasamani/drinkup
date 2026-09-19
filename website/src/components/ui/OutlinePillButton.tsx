import React from "react";

interface OutlinePillButtonProps {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "on-pool" | "default";
  className?: string;
  target?: string;
  rel?: string;
}

export const OutlinePillButton: React.FC<OutlinePillButtonProps> = ({
  children,
  href,
  onClick,
  variant = "on-pool",
  className = "",
  target,
  rel,
}) => {
  const variantClasses = {
    "on-pool":
      "text-onPool border-2 border-white/60 hover:border-white hover:bg-white/15 active:bg-white/25",
    default:
      "text-text border-2 border-line hover:border-text/40 hover:bg-card active:bg-sheet",
  }[variant];

  const baseClasses = `
    inline-flex items-center justify-center gap-2
    font-bold text-[13.5px] px-4 py-2 rounded-full
    transition-all duration-150 ease-out select-none cursor-pointer
    ${variantClasses}
    ${className}
  `;

  if (href) {
    return (
      <a
        href={href}
        className={baseClasses}
        target={target}
        rel={target === "_blank" ? (rel || "noopener noreferrer") : rel}
      >
        {children}
      </a>
    );
  }

  return (
    <button onClick={onClick} className={baseClasses} type="button">
      {children}
    </button>
  );
};
