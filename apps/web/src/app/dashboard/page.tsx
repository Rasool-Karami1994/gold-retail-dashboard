import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui";

/**
 * Customer landing page. Placeholder -- it exists so the middleware's
 * post-login redirect target resolves. Reaching it at all proves a valid
 * customer cookie was present.
 */
export default function DashboardPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-12">
      <header className="flex flex-col gap-1">
        <span className="text-sm text-link">پنل کاربری</span>
        <h1 className="text-2xl font-bold">داشبورد</h1>
      </header>

      <Card>
        <CardContent className="flex flex-col gap-2">
          <CardTitle>خوش آمدید</CardTitle>
          <CardDescription>
            این صفحه فقط برای کاربران وارد شده قابل مشاهده است.
          </CardDescription>
        </CardContent>
      </Card>
    </main>
  );
}
