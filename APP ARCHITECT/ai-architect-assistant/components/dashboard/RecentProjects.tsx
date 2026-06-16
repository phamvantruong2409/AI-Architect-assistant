import { ProjectsGrid } from "@/components/projects/ProjectsGrid";

export function RecentProjects() {
  return <ProjectsGrid limit={3} title="Dự án gần đây" viewAllHref="/projects" />;
}
