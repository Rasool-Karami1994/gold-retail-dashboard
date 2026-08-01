import * as React from "react";
import { cn } from "@/lib/cn";

export interface Breadcrumb {
  label: string;
  href?: string;
}

// `title` is omitted from the base attributes: HTMLAttributes types it as the
// tooltip string, and here it's the heading content.
export interface PageHeaderProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title: React.ReactNode;
  /** Small tinted line above the title, e.g. the section name. */
  eyebrow?: React.ReactNode;
  description?: React.ReactNode;
  /** Buttons or filters, pinned to the inline-end edge (left, in RTL). */
  actions?: React.ReactNode;
  breadcrumbs?: Breadcrumb[];
}

/**
 * Standard page heading: eyebrow, title, description on one side, actions on
 * the other. Stacks on narrow screens so the actions don't crush the title.
 */
export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
  breadcrumbs,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 flex-col gap-1">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="مسیر" className="mb-1">
            <ol className="flex flex-wrap items-center gap-2 text-xs text-fg-muted">
              {breadcrumbs.map((crumb, index) => (
                <li key={`${crumb.label}-${index}`} className="flex items-center gap-2">
                  {crumb.href ? (
                    <a href={crumb.href} className="hover:text-fg-secondary">
                      {crumb.label}
                    </a>
                  ) : (
                    <span aria-current="page">{crumb.label}</span>
                  )}
                  {index < breadcrumbs.length - 1 && (
                    // Follows the reading direction. SVG/glyph shapes aren't
                    // mirrored by dir="rtl", so flip it explicitly.
                    <span aria-hidden="true" className="text-fg-disabled rtl:-scale-x-100">
                      ›
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}

        {eyebrow && <span className="text-sm text-link">{eyebrow}</span>}

        <h1 className="truncate text-2xl font-bold text-fg">{title}</h1>

        {description && (
          <p className="text-sm text-fg-muted">{description}</p>
        )}
      </div>

      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>
      )}
    </header>
  );
}
