/**
 * Appends `?repo=<name>` to a path when a non-default repo is active, so links between pages
 * keep the viewer on the repository they chose. Pass `undefined` (the default repo) to leave
 * the path unchanged.
 */
export function repoHref(path: string, repo: string | undefined): string {
  if (repo === undefined || repo === "") {
    return path;
  }
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}repo=${encodeURIComponent(repo)}`;
}
