"use client";

import { useState } from "react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Modal,
  Select,
} from "@/components/ui";

export default function Page() {
  const [open, setOpen] = useState(false);

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <span className="text-sm text-link">پنل کاربری</span>
        <h1 className="text-2xl font-bold">کتابخانه‌ی کامپوننت‌ها</h1>
        <p className="text-sm text-fg-muted">
          کامپوننت‌های پایه بر اساس توکن‌های استخراج‌شده از اسکرین‌شات‌های مرجع.
        </p>
      </header>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>دکمه‌ها</CardTitle>
            <CardDescription>پنج حالت، سه اندازه</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-3">
            <Button>دکمه اصلی</Button>
            <Button variant="secondary">دکمه ثانویه</Button>
            <Button variant="ghost">شبح</Button>
            <Button variant="danger">حذف</Button>
            <Button variant="link">راهنمای استفاده</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">کوچک</Button>
            <Button size="md">متوسط</Button>
            <Button size="lg">بزرگ</Button>
            <Button loading>در حال ارسال</Button>
            <Button disabled>غیرفعال</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>فیلدهای فرم</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Input label="نام و نام خانوادگی" placeholder="رسول کرمی" />
          <Input
            label="شماره موبایل"
            placeholder="۰۹۱۲۳۴۵۶۷۸۹"
            hint="کد یک‌بار مصرف به این شماره ارسال می‌شود."
          />
          <Input
            label="کد تخفیف"
            defaultValue="OFF-40"
            error="این کد منقضی شده است."
          />
          <Select label="مرتب سازی" placeholder="انتخاب کنید">
            <option value="popular">محبوب ترین</option>
            <option value="newest">جدیدترین</option>
            <option value="oldest">قدیمی ترین</option>
          </Select>
        </CardContent>
      </Card>

      <Card variant="raised">
        <CardContent className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>مودال</CardTitle>
            <CardDescription>
              روی المان بومی dialog ساخته شده است.
            </CardDescription>
          </div>
          <Button onClick={() => setOpen(true)}>باز کردن</Button>
        </CardContent>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="حذف دوره از سبد خرید"
        description="این عملیات قابل بازگشت نیست."
        footer={
          <>
            <Button variant="danger" onClick={() => setOpen(false)}>
              حذف کن
            </Button>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              انصراف
            </Button>
          </>
        }
      >
        <p className="text-fg-secondary">
          دوره «متخصص Next.js 15» از سبد خرید شما حذف خواهد شد.
        </p>
      </Modal>
    </main>
  );
}
