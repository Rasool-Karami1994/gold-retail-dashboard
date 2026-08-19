import * as React from "react";
import { cn } from "@/lib/cn";

export interface Breadcrumb {
  label: string;
  href?: string;
}

export interface PageHeaderProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumbs?: Breadcrumb[];
}

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
