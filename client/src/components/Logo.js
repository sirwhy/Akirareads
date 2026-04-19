import React from 'react';

// AKIRAREADS logo - book with skull SVG icon matching the brand image
export function AkiraIcon({ size = 32, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect width="100" height="100" rx="22" fill="#e11d48"/>
      {/* Open book */}
      <path d="M18 68 L18 32 Q18 28 22 26 L48 20 L48 72 L22 78 Q18 76 18 72 Z" fill="white" opacity="0.9"/>
      <path d="M82 68 L82 32 Q82 28 78 26 L52 20 L52 72 L78 78 Q82 76 82 72 Z" fill="white" opacity="0.9"/>
      <line x1="50" y1="20" x2="50" y2="72" stroke="#e11d48" strokeWidth="3"/>
      {/* Skull on left page */}
      <ellipse cx="33" cy="47" rx="10" ry="10" fill="#e11d48" opacity="0.85"/>
      <rect x="27" y="53" width="12" height="7" rx="2" fill="#e11d48" opacity="0.85"/>
      <circle cx="30" cy="46" r="2.5" fill="white"/>
      <circle cx="36" cy="46" r="2.5" fill="white"/>
      <rect x="30" y="54" width="3" height="4" rx="1" fill="white" opacity="0.6"/>
      <rect x="34" y="54" width="3" height="4" rx="1" fill="white" opacity="0.6"/>
      {/* Lines on right page */}
      <line x1="58" y1="38" x2="74" y2="38" stroke="#e11d48" strokeWidth="2.5" strokeLinecap="round" opacity="0.5"/>
      <line x1="58" y1="44" x2="74" y2="44" stroke="#e11d48" strokeWidth="2.5" strokeLinecap="round" opacity="0.5"/>
      <line x1="58" y1="50" x2="70" y2="50" stroke="#e11d48" strokeWidth="2.5" strokeLinecap="round" opacity="0.5"/>
      <line x1="58" y1="56" x2="72" y2="56" stroke="#e11d48" strokeWidth="2.5" strokeLinecap="round" opacity="0.5"/>
      {/* Bottom scroll curl */}
      <path d="M20 72 Q23 78 28 75" stroke="white" strokeWidth="2" fill="none" opacity="0.7"/>
      <path d="M80 72 Q77 78 72 75" stroke="white" strokeWidth="2" fill="none" opacity="0.7"/>
    </svg>
  );
}

export function AkiraWordmark({ className = '' }) {
  return (
    <span className={`font-display tracking-widest ${className}`}>
      AKIRAREADS<span className="text-accent">.</span>
    </span>
  );
}

export default function AkiraLogo({ size = 32, showText = true, textSize = 'text-2xl', className = '' }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <AkiraIcon size={size} />
      {showText && <AkiraWordmark className={textSize} />}
    </div>
  );
}
