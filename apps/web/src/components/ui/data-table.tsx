"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import { Button } from "./button";

/**
 * Generic, sortable, paginated table.
 *
 * `T` flows from `data` through `columns` to every render callback, so
 * `row.someField` is checked and autocompleted at each use site -- no `any`,
 * no per-table interface.
 *
 * Sorting and pagination are client-side by default. Pass `manual` for
 * server-driven data: internal processing is skipped and the component becomes
 * a controlled view over whatever `data` and `totalRows` you hand it.
 */

export type SortDirection = "asc" | "desc";

export interface SortState {
  columnId: string;
  direction: SortDirection;
}

export interface Column<T> {
  /** Stable identifier, also used as the sort key. */
  id: string;
  header: React.ReactNode;
  /** Cell contents. Receives the whole row. */
  cell: (row: T, rowIndex: number) => React.ReactNode;
  /**
   * Comparable value for sorting. Supplying this is what makes a column
   * sortable -- a column of buttons has no meaningful order and simply omits it.
   */
  sortValue?: (row: T) => string | number | Date | null | undefined;
  align?: "start" | "center" | "end";
  /** Any CSS width, e.g. "12rem" or "20%". */
  width?: string;
  /** Hidden below the `sm` breakpoint. */
  hideOnMobile?: boolean;
  className?: string;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  /** Stable React key per row. Index is a fallback, not a good one. */
  rowKey: (row: T, index: number) => string;

  pageSize?: number;
  /** Hides the pager entirely. */
  paginated?: boolean;

  /** Sort to start from. Uncontrolled unless `onSortChange` is also given. */
  defaultSort?: SortState;
  sort?: SortState | null;
  onSortChange?: (sort: SortState | null) => void;

  page?: number;
  onPageChange?: (page: number) => void;

  /**
   * Server-side mode: skip internal sorting and slicing. `data` is assumed to
   * be exactly the page to display, and `totalRows` drives the pager.
   */
  manual?: boolean;
  totalRows?: number;

  loading?: boolean;
  emptyMessage?: React.ReactNode;
  onRowClick?: (row: T) => void;
  className?: string;
  /** Accessible caption. Visually hidden but read by screen readers. */
  caption?: string;
}

const alignClass = {
  start: "text-start",
  center: "text-center",
  end: "text-end",
} as const;

export function DataTable<T>({
  data,
  columns,
  rowKey,
  pageSize = 10,
  paginated = true,
  defaultSort,
  sort: controlledSort,
  onSortChange,
  page: controlledPage,
  onPageChange,
  manual = false,
  totalRows,
  loading = false,
  emptyMessage = "موردی یافت نشد.",
  onRowClick,
  className,
  caption,
}: DataTableProps<T>) {
  const [internalSort, setInternalSort] = React.useState<SortState | null>(
    defaultSort ?? null,
  );
  const [internalPage, setInternalPage] = React.useState(1);

  const sort = controlledSort !== undefined ? controlledSort : internalSort;
  const page = controlledPage ?? internalPage;

  const setSort = (next: SortState | null) => {
    if (controlledSort === undefined) setInternalSort(next);
    onSortChange?.(next);
  };

  const setPage = (next: number) => {
    if (controlledPage === undefined) setInternalPage(next);
    onPageChange?.(next);
  };

  /** asc -> desc -> unsorted, so a column can be cycled back off. */
  const toggleSort = (columnId: string) => {
    if (!sort || sort.columnId !== columnId) {
      setSort({ columnId, direction: "asc" });
    } else if (sort.direction === "asc") {
      setSort({ columnId, direction: "desc" });
    } else {
      setSort(null);
    }
    setPage(1);
  };

  const sorted = React.useMemo(() => {
    if (manual || !sort) return data;

    const column = columns.find((c) => c.id === sort.columnId);
    if (!column?.sortValue) return data;

    const factor = sort.direction === "asc" ? 1 : -1;

    // Copy first: Array.sort mutates, and mutating props is a bug that only
    // shows up once a parent memoises the array.
    return [...data].sort((a, b) => {
      const left = column.sortValue!(a);
      const right = column.sortValue!(b);

      // Nullish always sorts last, regardless of direction -- "no value" is
      // not smaller than every value, it's absent.
      if (left == null && right == null) return 0;
      if (left == null) return 1;
      if (right == null) return -1;

      if (typeof left === "number" && typeof right === "number") {
        return (left - right) * factor;
      }
      if (left instanceof Date && right instanceof Date) {
        return (left.getTime() - right.getTime()) * factor;
      }
      // localeCompare with "fa" so Persian text orders correctly; the numeric
      // option keeps "۱۰" after "۹" instead of before it.
      return (
        String(left).localeCompare(String(right), "fa", { numeric: true }) * factor
      );
    });
  }, [data, columns, sort, manual]);

  const total = manual ? (totalRows ?? data.length) : sorted.length;
  const pageCount = paginated ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  const currentPage = Math.min(page, pageCount);

  const rows = React.useMemo(() => {
    if (!paginated || manual) return sorted;
    const start = (currentPage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, paginated, manual, currentPage, pageSize]);

  const visibleColumns = columns;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/*
        `relative` is load-bearing, not decoration. The accessible caption and
        the sr-only column headers are `position: absolute`, and `overflow`
        does not clip an absolutely positioned descendant whose containing
        block sits outside the scroller. With a static wrapper their containing
        block was the viewport, so on a table wide enough to scroll they were
        laid out past its edge and dragged a horizontal scrollbar onto the whole
        page. Positioning the wrapper makes it their containing block, and the
        overflow above finally applies to them too.
      */}
      <div className="relative overflow-x-auto rounded-lg border border-border bg-surface">
        {/*
          `min-w-max` is what makes the `overflow-x-auto` above mean anything.
          Without it a table is free to shrink below its columns' declared
          widths, so a wide one silently compressed every cell instead of
          scrolling -- nine columns of invoice history turned into three-line
          cells rather than a scrollable row. When the columns do fit, max-content
          is narrower than the container and `w-full` still wins.
        */}
        <table className="w-full min-w-max border-collapse text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}

          <thead>
            <tr className="border-b border-border">
              {visibleColumns.map((column) => {
                const sortable = Boolean(column.sortValue);
                const active = sort?.columnId === column.id;

                return (
                  <th
                    key={column.id}
                    scope="col"
                    style={column.width ? { width: column.width } : undefined}
                    aria-sort={
                      active
                        ? sort!.direction === "asc"
                          ? "ascending"
                          : "descending"
                        : sortable
                          ? "none"
                          : undefined
                    }
                    className={cn(
                      "px-4 py-3 text-xs font-medium text-fg-muted",
                      alignClass[column.align ?? "start"],
                      column.hideOnMobile && "hidden sm:table-cell",
                      column.className,
                    )}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column.id)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-sm transition-colors",
                          "hover:text-fg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-400",
                          active && "text-fg",
                        )}
                      >
                        {column.header}
                        <SortIcon
                          direction={active ? sort!.direction : undefined}
                        />
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              Array.from({ length: Math.min(pageSize, 5) }).map((_, index) => (
                <tr key={`skeleton-${index}`} className="border-b border-border last:border-0">
                  {visibleColumns.map((column) => (
                    <td
                      key={column.id}
                      className={cn("px-4 py-3.5", column.hideOnMobile && "hidden sm:table-cell")}
                    >
                      <div className="h-3.5 animate-pulse rounded-sm bg-surface-raised" />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleColumns.length}
                  className="px-4 py-12 text-center text-sm text-fg-muted"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, rowIndex) => (
                <tr
                  key={rowKey(row, rowIndex)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    "border-b border-border transition-colors last:border-0",
                    onRowClick && "cursor-pointer hover:bg-surface-raised",
                  )}
                >
                  {visibleColumns.map((column) => (
                    <td
                      key={column.id}
                      className={cn(
                        "px-4 py-3.5 text-fg-secondary",
                        alignClass[column.align ?? "start"],
                        column.hideOnMobile && "hidden sm:table-cell",
                      )}
                    >
                      {column.cell(row, rowIndex)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {paginated && pageCount > 1 && (
        <Pagination
          page={currentPage}
          pageCount={pageCount}
          total={total}
          pageSize={pageSize}
          onChange={setPage}
        />
      )}
    </div>
  );
}

function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}) {
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {/* Through formatNumber like every other figure in the app: raw
          interpolation renders Latin digits, which sat next to Persian numerals
          in the very columns being counted. */}
      <p className="text-xs text-fg-muted">
        نمایش {formatNumber(first)}–{formatNumber(last)} از {formatNumber(total)}
      </p>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          قبلی
        </Button>

        <span className="px-2 text-xs text-fg-secondary">
          صفحه {formatNumber(page)} از {formatNumber(pageCount)}
        </span>

        <Button
          size="sm"
          variant="secondary"
          disabled={page >= pageCount}
          onClick={() => onChange(page + 1)}
        >
          بعدی
        </Button>
      </div>
    </div>
  );
}

/** Chevron pair; the active direction is highlighted. */
function SortIcon({ direction }: { direction?: SortDirection }) {
  return (
    <svg
      className="size-3 shrink-0"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="m3 5 3-3 3 3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={direction === "asc" ? 1 : 0.3}
      />
      <path
        d="m3 7 3 3 3-3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={direction === "desc" ? 1 : 0.3}
      />
    </svg>
  );
}
