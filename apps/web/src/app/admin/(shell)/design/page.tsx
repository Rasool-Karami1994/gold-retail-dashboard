"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from "recharts";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ChartCard,
  DataTable,
  DateRangeFilter,
  Input,
  Modal,
  PageHeader,
  Select,
  formatJalali,
  toast,
  type Column,
  type DateRange,
} from "@/components/ui";
import { chartSeries, gridProps, rtlAxisProps, tooltipProps } from "@/lib/chart-theme";
import { formatNumber } from "@/config/locale";
import { useUiStore } from "@/stores/ui.store";
import {
  GOLD_TYPE_LABELS,
  TYPE_LABELS,
  demoChartData,
  demoInvoices,
  type DemoInvoice,
} from "./demo-data";

const columns: Column<DemoInvoice>[] = [
  {
    id: "invoiceNumber",
    header: "شماره فاکتور",
    cell: (row) => <span className="font-medium text-fg">{row.invoiceNumber}</span>,
    sortValue: (row) => row.invoiceNumber,
    width: "12rem",
  },
  {
    id: "customer",
    header: "مشتری",
    cell: (row) => row.customer,
    sortValue: (row) => row.customer,
  },
  {
    id: "type",
    header: "نوع",
    cell: (row) => (
      <span
        className={
          row.type === "sell"
            ? "rounded-full bg-primary-500/15 px-2 py-0.5 text-2xs text-primary-300"
            : "rounded-full bg-accent/15 px-2 py-0.5 text-2xs text-accent"
        }
      >
        {TYPE_LABELS[row.type]}
      </span>
    ),
    sortValue: (row) => row.type,
    hideOnMobile: true,
  },
  {
    id: "goldType",
    header: "نوع طلا",
    cell: (row) => GOLD_TYPE_LABELS[row.goldType],
    sortValue: (row) => row.goldType,
    hideOnMobile: true,
  },
  {
    id: "weightGrams",
    header: "وزن (گرم)",
    cell: (row) => formatNumber(row.weightGrams),
    sortValue: (row) => row.weightGrams,
    align: "end",
  },
  {
    id: "totalAmount",
    header: "مبلغ کل",
    cell: (row) => formatNumber(row.totalAmount),
    sortValue: (row) => row.totalAmount,
    align: "end",
  },
  {
    id: "createdAt",
    header: "تاریخ",
    cell: (row) => formatJalali(row.createdAt),
    sortValue: (row) => row.createdAt,
    align: "end",
    hideOnMobile: true,
  },
  {
    id: "status",
    header: "وضعیت",
    cell: (row) => (
      <span
        className={
          row.status === "settled"
            ? "rounded-full bg-success-bg px-2 py-0.5 text-2xs text-success"
            : "rounded-full bg-warning-bg px-2 py-0.5 text-2xs text-warning"
        }
      >
        {row.status === "settled" ? "تسویه" : "باز"}
      </span>
    ),
    sortValue: (row) => row.status,
    align: "center",
  },
];

export default function DesignPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [range, setRange] = useState<DateRange | undefined>();
  const [loadingTable, setLoadingTable] = useState(false);
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  return (
    <div className="flex flex-col gap-10 px-6 py-10">
      <PageHeader
        eyebrow="پنل مدیریت"
        title="کتابخانه‌ی کامپوننت‌ها"
        description="مرجع بصری توکن‌ها و کامپوننت‌های مشترک. داده‌ها نمونه‌اند."
        breadcrumbs={[
          { label: "پنل مدیریت", href: "/admin/overview" },
          { label: "کتابخانه" },
        ]}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={toggleSidebar}>
              {sidebarCollapsed ? "باز کردن سایدبار" : "بستن سایدبار"}
            </Button>
            <Button size="sm" onClick={() => setModalOpen(true)}>
              مودال
            </Button>
          </>
        }
      />

      {/* ---- Buttons ---- */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>دکمه‌ها</CardTitle>
            <CardDescription>پنج حالت، سه اندازه</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button>دکمه اصلی</Button>
          <Button variant="secondary">ثانویه</Button>
          <Button variant="ghost">شبح</Button>
          <Button variant="danger">حذف</Button>
          <Button variant="link">راهنما</Button>
          <Button size="sm">کوچک</Button>
          <Button size="lg">بزرگ</Button>
          <Button loading>در حال ارسال</Button>
          <Button disabled>غیرفعال</Button>
        </CardContent>
      </Card>

      {/* ---- Toasts ---- */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>اعلان‌ها</CardTitle>
            <CardDescription>Zustand + live region</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            size="sm"
            onClick={() => toast.success("فاکتور با موفقیت ثبت شد")}
          >
            موفق
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() =>
              toast.error("ثبت فاکتور ناموفق بود", {
                description: "اتصال به سرور برقرار نشد.",
                action: {
                  label: "تلاش دوباره",
                  onClick: () => toast.info("در حال تلاش…"),
                },
              })
            }
          >
            خطا
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => toast.warning("موجودی رو به اتمام است")}
          >
            هشدار
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => toast.info("قیمت روز به‌روزرسانی شد")}
          >
            اطلاع
          </Button>
        </CardContent>
      </Card>

      {/* ---- Form fields ---- */}
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
          <Input label="کد تخفیف" defaultValue="OFF-40" error="این کد منقضی شده است." />
          <Select label="نوع طلا" placeholder="انتخاب کنید">
            <option value="melted">آب‌شده</option>
            <option value="new">نو</option>
            <option value="second-hand">دست دوم</option>
          </Select>
        </CardContent>
      </Card>

      {/* ---- Date range filter ---- */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>فیلتر بازه زمانی</CardTitle>
            <CardDescription>تقویم جلالی برای بازه دلخواه</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <DateRangeFilter value={range} onChange={setRange} />
          <p className="text-xs text-fg-muted" data-testid="range-readout">
            {range
              ? `${range.preset}: ${formatJalali(range.from)} تا ${formatJalali(range.to)}`
              : "بازه‌ای انتخاب نشده"}
          </p>
        </CardContent>
      </Card>

      {/* ---- Chart ---- */}
      <ChartCard title="گردش ماهانه" description="میلیون تومان" defaultPreset="year">
        <BarChart data={demoChartData} barGap={4}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="label" {...rtlAxisProps.x} />
          <YAxis {...rtlAxisProps.y} />
          <Tooltip {...tooltipProps} />
          <Legend wrapperStyle={{ fontSize: 12, direction: "rtl" }} />
          <Bar dataKey="sell" name="فروش" fill={chartSeries[0]} radius={[6, 6, 0, 0]} />
          <Bar dataKey="buy" name="خرید" fill={chartSeries[1]} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ChartCard>

      {/* ---- Data table ---- */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">جدول داده</h2>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setLoadingTable(true);
              window.setTimeout(() => setLoadingTable(false), 1200);
            }}
          >
            نمایش حالت بارگذاری
          </Button>
        </div>

        <DataTable
          data={demoInvoices}
          columns={columns}
          rowKey={(row) => row.id}
          pageSize={5}
          loading={loadingTable}
          caption="فهرست فاکتورهای نمونه"
          defaultSort={{ columnId: "createdAt", direction: "desc" }}
          onRowClick={(row) => toast.info(`فاکتور ${row.invoiceNumber}`)}
        />
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="حذف فاکتور"
        description="این عملیات قابل بازگشت نیست."
        footer={
          <>
            <Button
              variant="danger"
              onClick={() => {
                setModalOpen(false);
                toast.success("فاکتور حذف شد");
              }}
            >
              حذف کن
            </Button>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              انصراف
            </Button>
          </>
        }
      >
        <p className="text-fg-secondary">
          فاکتور INV-20260801-0001 برای همیشه حذف خواهد شد.
        </p>
      </Modal>
    </div>
  );
}
