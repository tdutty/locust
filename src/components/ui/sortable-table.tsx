'use client';

import React, { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

export interface SortableTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  selectable?: boolean;
  selectedKeys?: Set<string>;
  onSelectionChange?: (keys: Set<string>) => void;
  page?: number;
  pageSize?: number;
  totalItems?: number;
  onPageChange?: (page: number) => void;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  isLoading?: boolean;
}

export const SortableTable = React.forwardRef<HTMLDivElement, SortableTableProps<any>>(
  (
    {
      columns,
      data,
      keyExtractor,
      sortKey,
      sortDirection = 'asc',
      onSort,
      selectable = false,
      selectedKeys = new Set(),
      onSelectionChange,
      page = 1,
      pageSize = 20,
      totalItems,
      onPageChange,
      onRowClick,
      emptyMessage = 'No data available',
      isLoading = false,
    },
    ref
  ) => {
    const [localPageSize, setLocalPageSize] = useState(pageSize);

    // Calculate pagination
    const paginatedData = useMemo(() => {
      const startIndex = (page - 1) * localPageSize;
      return data.slice(startIndex, startIndex + localPageSize);
    }, [data, page, localPageSize]);

    const totalPages = Math.ceil((totalItems || data.length) / localPageSize);
    const startIndex = (page - 1) * localPageSize + 1;
    const endIndex = Math.min(page * localPageSize, totalItems || data.length);

    // Selection handlers
    const handleSelectAll = (checked: boolean) => {
      if (checked) {
        const allKeys = new Set(paginatedData.map(keyExtractor));
        onSelectionChange?.(new Set([...selectedKeys, ...allKeys]));
      } else {
        const currentPageKeys = new Set(paginatedData.map(keyExtractor));
        const newSelected = new Set(selectedKeys);
        currentPageKeys.forEach((key) => newSelected.delete(key));
        onSelectionChange?.(newSelected);
      }
    };

    const handleSelectRow = (key: string, checked: boolean) => {
      const newSelected = new Set(selectedKeys);
      if (checked) {
        newSelected.add(key);
      } else {
        newSelected.delete(key);
      }
      onSelectionChange?.(newSelected);
    };

    const isPageFullySelected =
      paginatedData.length > 0 &&
      paginatedData.every((item) => selectedKeys.has(keyExtractor(item)));

    // Sort handler
    const handleSort = (columnKey: string) => {
      onSort?.(columnKey);
    };

    // Page size change
    const handlePageSizeChange = (newSize: number) => {
      setLocalPageSize(newSize);
      onPageChange?.(1);
    };

    // Render loading skeleton
    if (isLoading) {
      return (
        <div ref={ref} className="card overflow-hidden">
          <div className="animate-pulse">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="border-b border-slate-100 py-3 px-4">
                <div className="h-4 bg-slate-200 rounded w-3/4" />
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Render empty state
    if (data.length === 0) {
      return (
        <div ref={ref} className="card overflow-hidden">
          <div className="flex items-center justify-center py-12">
            <p className="text-slate-500 text-sm">{emptyMessage}</p>
          </div>
        </div>
      );
    }

    return (
      <div ref={ref} className="card overflow-hidden flex flex-col">
        {/* Table */}
        <div className="overflow-x-auto flex-1">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {/* Checkbox Column */}
                {selectable && (
                  <th className="px-4 py-3 w-12">
                    <input
                      type="checkbox"
                      checked={isPageFullySelected}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                )}

                {/* Data Columns */}
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={`sortable-header px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider ${
                      column.width || ''
                    }`}
                    style={{ width: column.width }}
                  >
                    {column.sortable ? (
                      <button
                        onClick={() => handleSort(column.key)}
                        className="flex items-center gap-1.5 hover:text-slate-700 transition-colors"
                      >
                        {column.label}
                        {sortKey === column.key && (
                          <>
                            {sortDirection === 'asc' ? (
                              <ChevronUp className="w-4 h-4 text-blue-600" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-blue-600" />
                            )}
                          </>
                        )}
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((item) => {
                const itemKey = keyExtractor(item);
                const isSelected = selectedKeys.has(itemKey);

                return (
                  <tr
                    key={itemKey}
                    onClick={() => onRowClick?.(item)}
                    className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                      isSelected ? 'bg-primary-50' : ''
                    } ${onRowClick ? 'cursor-pointer' : ''}`}
                  >
                    {/* Checkbox Column */}
                    {selectable && (
                      <td
                        className="data-cell px-4 py-3 w-12"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) =>
                            handleSelectRow(itemKey, e.target.checked)
                          }
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                    )}

                    {/* Data Cells */}
                    {columns.map((column) => (
                      <td
                        key={`${itemKey}-${column.key}`}
                        className={`data-cell px-4 py-3 text-sm text-slate-900 ${
                          column.className || ''
                        }`}
                        style={{ width: column.width }}
                      >
                        {column.render
                          ? column.render(item)
                          : (item as any)[column.key]}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <div className="text-xs text-slate-600">
            Showing {startIndex}-{endIndex} of{' '}
            {totalItems !== undefined ? totalItems : data.length}
          </div>

          <div className="flex items-center gap-4">
            {/* Page Size Selector */}
            <div className="flex items-center gap-2">
              <label htmlFor="pageSize" className="text-xs text-slate-600">
                Per page:
              </label>
              <select
                id="pageSize"
                value={localPageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="input-base text-xs py-1 px-2"
              >
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>

            {/* Pagination Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => onPageChange?.(page - 1)}
                disabled={page === 1}
                className="btn-ghost p-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="text-xs text-slate-600">
                Page {page} of {totalPages || 1}
              </span>

              <button
                onClick={() => onPageChange?.(page + 1)}
                disabled={page >= totalPages || totalPages === 0}
                className="btn-ghost p-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

SortableTable.displayName = 'SortableTable';

export default SortableTable;
