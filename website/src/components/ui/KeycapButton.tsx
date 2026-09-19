import React from "react";

interface KeycapButtonProps {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  size?: "sm" | "md" | "lg";
  className?: string;
  target?: string;
  rel?: string;
  download?: string | boolean;
}

export const KeycapButton: React.FC<KeycapButtonProps> = ({
  children,
  href,
  onClick,
  size = "md",
  className = "",
  target,
  rel,
  download,
}) => {
  const sizeClasses = {
    sm: "text-xs px-3 py-1.5 font-bold",
    md: "text-sm sm:text-base px-4 py-2 sm:px-5 sm:py-2.5 font-extrabold",
    lg: "text-base sm:text-lg px-6 py-3 sm:px-8 sm:py-3.5 font-extrabold",
  }[size];

  const baseClasses = `
    inline-flex items-center justify-center gap-2
    bg-fizz text-ink rounded-full tracking-tight select-none
    shadow-keycap hover:shadow-keycapHover active:shadow-keycapActive
    hover:-translate-y-0.5 active:translate-y-0.5
    transition-all duration-100 ease-out cursor-pointer text-center
    ${sizeClasses}
    ${className}
  `;

  if (href) {
    return (
      <a
        href={href}
        className={baseClasses}
        target={target}
        rel={target === "_blank" ? (rel || "noopener noreferrer") : rel}
        download={download}
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
