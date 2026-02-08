'use client';

import React from 'react';
import { X } from 'lucide-react';

export interface FilterChipProps {
  label: string;
  value: string;
  onRemove: () => void;
}

export const FilterChip: React.FC<FilterChipProps> = ({
  label,
  value,
  onRemove,
}) => {
  return (
    <div className="filter-chip">
      <span className="text-xs font-medium">{label}</span>
      <button
        onClick={onRemove}
        className="filter-chip-remove"
        aria-label={`Remove ${label} filter`}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

export default FilterChip;
