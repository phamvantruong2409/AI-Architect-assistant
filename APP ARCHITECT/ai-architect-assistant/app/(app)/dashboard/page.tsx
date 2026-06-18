import { Cover } from "@/components/dashboard/Cover";
import { Greeting } from "@/components/dashboard/Greeting";
import { PromptBar } from "@/components/dashboard/PromptBar";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { RecentProjects } from "@/components/dashboard/RecentProjects";
import { NewsUpdates } from "@/components/dashboard/NewsUpdates";
import { InspirationToday } from "@/components/dashboard/InspirationToday";

export default function DashboardPage() {
  return (
    <div className="min-h-full">
      <div className="grid min-h-full lg:grid-cols-[1fr_300px]">
        {/* Left: Hero + main content */}
        <div className="relative min-w-0">
          {/* Background image — spans hero + QuickActions */}
          <div className="absolute inset-x-0 top-0 -z-10 overflow-hidden" style={{ height: "610px" }}>
            <Cover />
            {/* Dark mode fade — bắt đầu sớm hơn */}
            <div className="absolute inset-x-0 bottom-0 h-64 hidden dark:block bg-gradient-to-t from-background via-background/70 to-transparent" />
            {/* Light mode fade — chỉ 20% cuối, mờ dần hoàn toàn */}
            <div className="absolute inset-x-0 bottom-0 h-32 dark:hidden bg-gradient-to-t from-background via-background/60 to-transparent" />
            {/* Dark mode side overlay */}
            <div className="absolute inset-0 hidden dark:block bg-gradient-to-r from-background/70 via-background/40 to-transparent" />
            <div className="absolute inset-0 hidden dark:block bg-gradient-to-b from-black/15 to-transparent" />
            {/* Light mode side overlay */}
            <div className="absolute inset-0 dark:hidden bg-gradient-to-r from-black/50 via-black/20 to-transparent" />
            <div className="absolute inset-0 dark:hidden bg-gradient-to-b from-black/15 to-transparent" />
          </div>

          {/* Hero text area */}
          <div className="relative flex flex-col justify-end px-7 pb-8 pt-24" style={{ minHeight: "440px" }}>
            <Greeting />
            <div className="mt-5 max-w-2xl">
              <PromptBar />
            </div>
          </div>

          {/* Main content — sits on top of fading image */}
          <div className="space-y-6 px-5 py-5">
            <QuickActions />
            <RecentProjects />
          </div>
        </div>

        {/* Right panel */}
        <div className="border-l border-border bg-surface/30 px-4 py-5 space-y-5">
          <InspirationToday />
          <NewsUpdates />
        </div>
      </div>
    </div>
  );
}
