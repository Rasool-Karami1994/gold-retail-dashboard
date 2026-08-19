import { Card, CardContent, CardDescription, CardTitle, PageHeader } from "@/components/ui";

export function SectionPlaceholder({
  eyebrow,
  title,
  description,
  endpoint,
}: {
  eyebrow: string;
  title: string;
  description: string;
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
