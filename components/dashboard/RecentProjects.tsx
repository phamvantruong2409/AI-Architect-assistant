import { ProjectsGrid } from "@/components/projects/ProjectsGrid";

export function RecentProjects() {
  return <ProjectsGrid limit={4} title="Dự án gần đây" viewAllHref="/projects" newProjectInHeader />;
}
