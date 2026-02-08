'use client';

import React, { useState } from 'react';
import { ChevronDown, SlidersHorizontal, Search, X } from 'lucide-react';

export interface FilterOption {
  label: string;
  value: string;
  count?: number;
}

export interface FilterSection {
  id: string;
  title: string;
  type: 'select' | 'checkbox' | 'search';
  options?: FilterOption[];
  activeValues: string[];
  onChange: (values: string[]) => void;
}

export interface FilterPanelProps {
  sections: FilterSection[];
  onClearAll: () => void;
  onTogglePanel?: () => void;
  activeFilterCount: number;
  isOpen?: boolean;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  sections,
  onClearAll,
  onTogglePanel,
  activeFilterCount,
  isOpen = true,
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(sections.map((s) => s.id))
  );

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  if (!isOpen) return null;

  return (
    <div className="w-[280px] bg-white border-r border-slate-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-slate-600" />
          <span className="text-sm font-semibold text-slate-900">Filters</span>
          {activeFilterCount > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-semibold text-white bg-blue-500 rounded-full">
              {activeFilterCount}
            </span>
          )}
        </div>
        {activeFilterCount > 0 && (
          <button
            onClick={onClearAll}
            className="text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            Clear all ({activeFilterCount})
          </button>
        )}
      </div>

      {/* Filter Sections */}
      <div className="flex-1 overflow-y-auto">
        {sections.map((section) => (
          <div key={section.id} className="border-b border-slate-100">
            {/* Section Header */}
            <button
              onClick={() => toggleSection(section.id)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                {section.activeValues.length > 0 && (
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                )}
                <span className="text-sm font-medium text-slate-900">
                  {section.title}
                </span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform ${
                  expandedSections.has(section.id) ? '' : '-rotate-90'
                }`}
              />
            </button>

            {/* Section Content */}
            {expandedSections.has(section.id) && (
              <div className="px-4 pb-3">
                {section.type === 'select' && (
                  <select
                    multiple
                    value={section.activeValues}
                    onChange={(e) => {
                      const values = Array.from(e.target.selectedOptions, (o) =>
                        o.value
                      );
                      section.onChange(values);
                    }}
                    className="input-base w-full text-sm"
                  >
                    {section.options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                        {option.count !== undefined && ` (${option.count})`}
                      </option>
                    ))}
                  </select>
                )}

                {section.type === 'checkbox' && (
                  <div className="space-y-2">
                    {section.options?.map((option) => (
                      <label
                        key={option.value}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={section.activeValues.includes(option.value)}
                          onChange={(e) => {
                            const newValues = e.target.checked
                              ? [...section.activeValues, option.value]
                              : section.activeValues.filter(
                                  (v) => v !== option.value
                                );
                            section.onChange(newValues);
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-slate-700">
                          {option.label}
                        </span>
                        {option.count !== undefined && (
                          <span className="text-xs text-slate-500">
                            ({option.count})
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                )}

                {section.type === 'search' && (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search..."
                      value={section.activeValues[0] || ''}
                      onChange={(e) => {
                        section.onChange(e.target.value ? [e.target.value] : []);
                      }}
                      className="input-base w-full pl-9 text-sm"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default FilterPanel;
