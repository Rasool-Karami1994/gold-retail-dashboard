import Link from "next/link";
import { Card, CardContent, buttonStyles } from "@/components/ui";
import { ROUTES } from "@/config/routes";

/**
 * 404, in Persian and in this app's chrome.
 *
 * It points at the customer front door rather than the admin overview: someone
 * who followed a broken link is far more likely to be a customer, and an admin
 * lands on their own home from `/` anyway -- the middleware redirects them
 * before this page's link resolves.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <span className="font-mono text-3xl font-bold text-fg-disabled" dir="ltr">
            404
          </span>

          <div className="flex flex-col gap-2">
            <h1 className="text-lg font-bold text-fg">صفحه پیدا نشد</h1>
            <p className="text-sm text-fg-muted">
              نشانی وارد شده وجود ندارد یا صفحه جابه‌جا شده است.
            </p>
          </div>

          <Link href={ROUTES.customerLogin} className={buttonStyles()}>
            بازگشت به صفحه‌ی اصلی
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
