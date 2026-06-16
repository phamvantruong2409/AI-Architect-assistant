import { SiteHeader } from "@/components/marketing/SiteHeader";
import { Hero } from "@/components/marketing/Hero";
import { SiteFooter } from "@/components/marketing/SiteFooter";

export default function Home() {
  return (
    <div className="relative h-screen overflow-hidden">
      <Hero />
      <SiteHeader />
      <SiteFooter />
    </div>
  );
}
