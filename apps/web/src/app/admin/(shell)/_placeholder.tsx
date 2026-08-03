import { Card, CardContent, CardDescription, CardTitle, PageHeader } from "@/components/ui";

/**
 * Stand-in for a section that has a sidebar entry but no screen yet.
 *
 * The underscore prefix keeps this out of the router -- Next ignores
 * `_`-prefixed folders and this file exports no page. It exists so the four
 * navigation targets resolve instead of 404ing, which would make the shell look
 * broken while it is being built out.
 */
export function SectionPlaceholder({
  eyebrow,
  title,
  description,
  endpoint,
}: {
  eyebrow: string;
  title: string;
  description: string;
  /** The API this screen will read, so the next step has a starting point. */
  endpoint: string;
}) {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader eyebrow={eyebrow} title={title} description={description} />

      <Card>
        <CardContent className="flex flex-col gap-2">
          <CardTitle>هنوز ساخته نشده</CardTitle>
          <CardDescription>
            این بخش در مرحله‌ی بعد به داده‌های واقعی متصل می‌شود.
          </CardDescription>
          <code className="mt-2 w-fit rounded-md bg-surface-sunken px-2 py-1 text-xs text-fg-secondary" dir="ltr">
            {endpoint}
          </code>
        </CardContent>
      </Card>
    </div>
  );
}
