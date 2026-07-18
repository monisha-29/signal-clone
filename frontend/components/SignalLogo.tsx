/**
 * SignalLogo.tsx
 * This component provides an SVG recreation of the Signal messenger logo.
 * It can be customized with size and color props.
 */
'use client';

import React from 'react';

/**
 * Props for the SignalLogo component.
 */
interface SignalLogoProps {
  size?: number;
  color?: string;
  className?: string;
}

/**
 * SignalLogo Component
 * Renders the Signal logo consisting of a speech-bubble and dashed orbit circle.
 *
 * @param {SignalLogoProps} props - Component props containing size, color, and className.
 * @returns {JSX.Element} The rendered SVG logo.
 */
export default function SignalLogo({ size = 48, color = '#fff', className }: SignalLogoProps) {
  // Render the SVG graphic matching the signal logo
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      fill="none"
    >
      {/* Dashed orbit circle representing the outer ring */}
      <circle
        cx="50"
        cy="50"
        r="44"
        stroke={color}
        strokeWidth="3"
        strokeDasharray="10 6"
        strokeLinecap="round"
        fill="none"
      />

      {/* Speech-bubble body in the center */}
      <path
        d="M30 42
           C30 30 39 22 52 22
           C65 22 74 30 74 42
           C74 54 65 62 52 62
           L44 62
           L34 72
           L36 60
           C32 56 30 50 30 42Z"
        fill={color}
      />
    </svg>
  );
}
