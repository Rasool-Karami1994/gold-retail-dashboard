import { PageHeader } from "@/components/ui";
import { ProfileView } from "./profile-view";

export default function CustomerProfilePage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        eyebrow="حساب کاربری"
        title="اطلاعات کاربری"
        description="مشخصاتی که فروشگاه برای حساب شما ثبت کرده است."
      />

      <ProfileView />
    </div>
  );
}
