import { ProjectsRootSettings } from "@/components/settings/ProjectsRootSettings";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-lg">Cài đặt</h1>
      <p className="mt-1 text-sm text-foreground-soft">
        Quản lý hồ sơ, gói Studio Pro và tuỳ chọn thông báo sẽ có sớm.
      </p>

      <div className="mt-4">
        <ProjectsRootSettings />
      </div>
    </div>
  );
}
