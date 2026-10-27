export function apiQueryKey(owner: string | null, epoch: number, endpoint: string) {
  const url = new URL(endpoint, "https://query.invalid");
  url.searchParams.sort();
  return ["account", owner, epoch, resourceGroup(url.pathname), url.pathname, Object.fromEntries(url.searchParams)] as const;
}

export function resourceGroup(path: string): string {
  if (path === "/career-automation/fields") return "career-fields";
  if (path.startsWith("/career-automation")) return "roadmap";
  if (path === "/jobs/external/matches") return "matches";
  if (path.startsWith("/jobs")) return "jobs";
  if (path.startsWith("/dashboard")) return "dashboard";
  if (path === "/progress") return "progress";
  if (path.startsWith("/interviews")) return "interviews";
  if (path.startsWith("/resume-profile")) return "resume-profile";
  if (path.startsWith("/resume")) return "resume";
  if (path.startsWith("/bookmarks")) return "bookmarks";
  if (path.startsWith("/cs/")) return "chat";
  return "profile";
}

export function resourceStaleTime(path: string): number {
  const group = resourceGroup(path);
  if (group === "career-fields") return 60 * 60_000;
  if (group === "roadmap") return path.endsWith("/summary") ? 60_000 : 120_000;
  if (["dashboard", "progress", "interviews", "bookmarks"].includes(group)) return 30_000;
  return 60_000;
}

export function mutationGroups(path: string, body?:unknown): string[] {
  if (/^\/(resume|resume-profile|cv-builder|cv-optimization)(\/|$)/.test(path))
    return ["resume", "resume-profile", "jobs", "matches", "roadmap", "progress", "dashboard"];
  if (path.startsWith("/career-profile") || path.startsWith("/skills")) return ["roadmap", "jobs", "matches", "progress", "dashboard"];
  if (path.startsWith("/interviews")) return ["interviews", "progress", "dashboard", "roadmap", "jobs", "matches"];
  if(path==='/career-automation/job-preferences' && body && typeof body==='object' && !('targetRole' in body))return ['roadmap','jobs','matches'];
  if(/^\/career-automation\/tasks\//.test(path))return ['roadmap'];
  if (path.startsWith("/career-automation")) return ["roadmap", "jobs", "matches", "progress", "dashboard"];
  if (path === "/jobs/external/refresh") return ["jobs", "matches"];
  if (path.startsWith("/bookmarks")) return ["bookmarks"];
  if (path.startsWith("/cs/")) return ["chat"];
  if (path === "/auth/profile") return ["profile"];
  return [];
}
