export { Button, type ButtonProps } from "./button";
// From button-styles, not button: that module is `"use client"`, and a server
// component cannot call a function exported from one. See button-styles.ts.
export {
  buttonStyles,
  type ButtonStyleOptions,
  type ButtonVariant,
  type ButtonSize,
} from "./button-styles";
export { Input, type InputProps } from "./input";
// Grouped digits while typing, with the amount spelled out underneath. Use it
// for every Toman field; pass showWords={false} for anything not money.
export { CurrencyInput, type CurrencyInputProps } from "./currency-input";
// A generic segmented code field, not a customer-registration detail: the
// public sign-in and the staff add-customer wizard both enter a code with it.
export { OtpInput, type OtpInputProps } from "./otp-input";
export { Select, type SelectProps } from "./select";
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "./card";
export { Modal, type ModalProps } from "./modal";

export { ErrorState, type ErrorStateProps } from "./error-state";
export { SidebarMenuButton } from "./menu-button";
export { RouteError } from "./route-error";
export { PageHeader, type PageHeaderProps, type Breadcrumb } from "./page-header";
export {
  Sidebar,
  sidebarWideOnly,
  type SidebarProps,
  type SidebarItem,
} from "./sidebar";
export {
  DataTable,
  type DataTableProps,
  type Column,
  type SortState,
  type SortDirection,
} from "./data-table";
export {
  DateRangeFilter,
  type DateRangeFilterProps,
} from "./date-range-filter";
export { ChartCard, type ChartCardProps } from "./chart-card";
// The no-axis counterpart to ChartCard, for figures that don't vary over one.
export { StatCard, type StatCardProps, type StatTone } from "./stat-card";

export { Toaster } from "./toast";
// Straight from the store, not via toast.tsx -- see the note at the bottom of
// that file about Fast Refresh.
export { toast, useToastStore } from "@/stores/toast.store";
export type { Toast, ToastVariant, ToastOptions } from "@/stores/toast.store";

/* Re-exported so consumers get the range types without a second import path. */
export type { DateRange, DateRangePreset } from "@/lib/jalali";
export {
  formatJalali,
  formatJalaliRange,
  rangeForPreset,
  PRESET_LABELS,
} from "@/lib/jalali";
