import Link from "next/link";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui";

/**
 * Admin landing page. Placeholder -- it exists so the middleware's post-login
 * redirect target resolves. Reaching it proves a valid admin cookie was
 * present.
 */
export default function AdminOverviewPage() {
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-12">
      <header className="flex flex-col gap-1">
        <span className="text-sm text-link">پنل مدیریت</span>
        <h1 className="text-2xl font-bold">نمای کلی</h1>
      </header>

      <Card>
        <CardContent className="flex flex-col gap-2">
          <CardTitle>خوش آمدید</CardTitle>
          <CardDescription>
            این صفحه فقط برای کارکنان وارد شده قابل مشاهده است.
          </CardDescription>
        </CardContent>
      </Card>

      <Card interactive>
        <CardContent>
          <Link href="/admin/design" className="flex flex-col gap-1">
            <CardTitle>کتابخانه‌ی کامپوننت‌ها</CardTitle>
            <CardDescription>
              مرجع بصری توکن‌ها و کامپوننت‌های پایه
            </CardDescription>
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
