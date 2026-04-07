type PackageJson = {
  version?: unknown;
  [key: string]: unknown;
};

function isSemver(v: string): boolean {
  // semver: MAJOR.MINOR.PATCH with optional -prerelease and +build
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(v);
}

async function main() {
  const nextVersion = process.argv.slice(2)[0];
  if (!nextVersion) {
    console.error("Usage: bun run version:set <version>");
    process.exit(1);
  }
  if (!isSemver(nextVersion)) {
    console.error(`Invalid semver: ${nextVersion}`);
    process.exit(1);
  }

  const root = new URL("../", import.meta.url);
  const pkgUrl = new URL("package.json", root);

  const pkgText = await Bun.file(pkgUrl).text();
  const pkg = JSON.parse(pkgText) as PackageJson;

  const prevVersion = typeof pkg.version === "string" ? pkg.version : null;
  pkg.version = nextVersion;

  const serialized = JSON.stringify(pkg, null, 2) + "\n";
  if (serialized !== pkgText) {
    await Bun.write(pkgUrl, serialized);
  }

  const readmeUrl = new URL("README.md", root);
  const readme = await Bun.file(readmeUrl).text();
  const nextReadme = readme.replace(
    /(https:\/\/img\.shields\.io\/badge\/Version-)([^-]+)(-blue\?style=for-the-badge)/g,
    `$1${nextVersion}$3`,
  );
  if (nextReadme !== readme) {
    await Bun.write(readmeUrl, nextReadme);
  }

  console.log(
    prevVersion
      ? `Version updated: ${prevVersion} -> ${nextVersion}`
      : `Version set to: ${nextVersion}`,
  );
}

main().catch((err) => {
  const e = err instanceof Error ? err : new Error(String(err));
  console.error(e.message);
  process.exit(1);
});

