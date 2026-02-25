import React from 'react';

export function TooltipProvider({ children }) {
  return <>{children}</>;
}

export function Tooltip({ children }) {
  return <span className="tooltip-wrapper">{children}</span>;
}

export function TooltipTrigger({ children, asChild = false }) {
  return <>{children}</>;
}

export function TooltipContent({ children }) {
  return <span className="tooltip-content">{children}</span>;
}
