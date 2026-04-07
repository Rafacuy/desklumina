let cachedVersionPromise: Promise<string> | null = null;

type PackageJson = {
  version?: unknown;
};

async function readPackageJsonVersion(): Promise<string> {
  try {
    const pkgUrl = new URL("../../package.json", import.meta.url);
    const pkg = (await Bun.file(pkgUrl).json()) as PackageJson;
    return typeof pkg.version === "string" && pkg.version.trim() ? pkg.version.trim() : "dev";
  } catch {
    return "dev";
  }
}

export async function getAppVersion(): Promise<string> {
  if (!cachedVersionPromise) {
    cachedVersionPromise = readPackageJsonVersion();
  }
  return cachedVersionPromise;
}

