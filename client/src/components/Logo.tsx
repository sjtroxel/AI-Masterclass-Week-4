// client/src/components/Logo.tsx
import React from 'react';

interface LogoProps {
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ className = "w-32 h-32" }) => {
  return (
    <svg 
      viewBox="0 0 100 120" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      className={className}
    >
      {/* The Map Pin Body */}
      <path 
        d="M50 115C50 115 85 75 85 45C85 25.67 69.33 10 50 10C30.67 10 15 25.67 15 45C15 75 50 115 50 115Z" 
        stroke="currentColor" 
        strokeWidth="6" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      
      {/* The Clock Face Outer Circle */}
      <circle 
        cx="50" 
        cy="45" 
        r="25" 
        stroke="currentColor" 
        strokeWidth="4"
      />
      
      {/* Clock Hands (Setting the time to roughly 10:10) */}
      <line 
        x1="50" y1="45" x2="50" y2="30" 
        stroke="currentColor" 
        strokeWidth="4" 
        strokeLinecap="round"
      />
      <line 
        x1="50" y1="45" x2="65" y2="45" 
        stroke="currentColor" 
        strokeWidth="4" 
        strokeLinecap="round"
      />

      {/* Subtle Clock Ticks */}
      <line x1="50" y1="23" x2="50" y2="27" stroke="currentColor" strokeWidth="2" />
      <line x1="72" y1="45" x2="68" y2="45" stroke="currentColor" strokeWidth="2" />
      <line x1="50" y1="67" x2="50" y2="63" stroke="currentColor" strokeWidth="2" />
      <line x1="28" y1="45" x2="32" y2="45" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
};

export default Logo;