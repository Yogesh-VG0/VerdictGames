export type NavSearchParamSource = Pick<URLSearchParams, "get" | "getAll"> | null | undefined;
export type NavPathMatchMode = "exact" | "prefix";

function matchesPath(pathname: string, hrefPath: string, pathMode: NavPathMatchMode): boolean {
  if (hrefPath === "/") {
    return pathname === "/";
  }

  if (pathMode === "exact") {
    return pathname === hrefPath;
  }

  return pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
}

function includesAllValues(actualValues: string[], requiredValues: string[]): boolean {
  const remainingValues = [...actualValues];

  for (const value of requiredValues) {
    const matchIndex = remainingValues.indexOf(value);
    if (matchIndex === -1) {
      return false;
    }

    remainingValues.splice(matchIndex, 1);
  }

  return true;
}

export function isNavHrefActive(
  pathname: string,
  searchParams: NavSearchParamSource,
  href: string,
  pathMode: NavPathMatchMode = "prefix"
): boolean {
  const [hrefPath, queryString = ""] = href.split("?");

  if (!queryString) {
    return matchesPath(pathname, hrefPath, pathMode);
  }

  if (!searchParams || !matchesPath(pathname, hrefPath, "exact")) {
    return false;
  }

  const targetParams = new URLSearchParams(queryString);
  const targetKeys = Array.from(new Set(Array.from(targetParams.keys())));

  return targetKeys.every((key) => includesAllValues(searchParams.getAll(key), targetParams.getAll(key)));
}

export function hasActiveNavHref(
  pathname: string,
  searchParams: NavSearchParamSource,
  hrefs: readonly string[]
): boolean {
  return hrefs.some((href) => isNavHrefActive(pathname, searchParams, href, "exact"));
}
