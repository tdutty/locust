'use client';

import React, { useMemo } from 'react';

export interface AvatarCircleProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const COLOR_PALETTE = [
  '#6366f1', // indigo
  '#ec4899', // pink
  '#f59e0b', // amber
  '#10b981', // emerald
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ef4444', // red
  '#06b6d4', // cyan
];

// Simple hash function to generate deterministic color from string
const hashString = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
};

export const AvatarCircle: React.FC<AvatarCircleProps> = ({
  name,
  size = 'md',
  className = '',
}) => {
  const sizeConfig = useMemo(
    () => ({
      sm: { width: 24, height: 24, fontSize: '0.625rem' },
      md: { width: 32, height: 32, fontSize: '0.75rem' },
      lg: { width: 40, height: 40, fontSize: '0.875rem' },
    }),
    []
  );

  const config = sizeConfig[size];

  const initials = useMemo(() => {
    return name
      .split(' ')
      .slice(0, 2)
      .map((word) => word[0])
      .join('')
      .toUpperCase();
  }, [name]);

  const backgroundColor = useMemo(() => {
    const hash = hashString(name);
    return COLOR_PALETTE[hash % COLOR_PALETTE.length];
  }, [name]);

  return (
    <div
      className={`rounded-full flex items-center justify-center font-medium text-white flex-shrink-0 ${className}`}
      style={{
        width: `${config.width}px`,
        height: `${config.height}px`,
        fontSize: config.fontSize,
        backgroundColor,
      }}
      title={name}
    >
      {initials}
    </div>
  );
};

export default AvatarCircle;
