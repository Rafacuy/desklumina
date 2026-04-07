type PackageJson = {
  version?: unknown;
};

async function main() {
  const root = new URL("../", import.meta.url);

  const pkgUrl = new URL("package.json", root);
  const readmeUrl = new URL("README.md", root);

  const pkg = (await Bun.file(pkgUrl).json()) as PackageJson;
  const version = typeof pkg.version === "string" && pkg.version.trim() ? pkg.version.trim() : null;
  if (!version) {
    console.error("Could not determine version from package.json");
    process.exit(1);
  }

  const readme = await Bun.file(readmeUrl).text();
  const next = readme.replace(
    /(https:\/\/img\.shields\.io\/badge\/Version-)([^-]+)(-blue\?style=for-the-badge)/g,
    `$1${version}$3`,
  );

  if (next !== readme) {
    await Bun.write(readmeUrl, next);
    console.log(`README version badge synced to ${version}`);
  } else {
    console.log("README already up to date");
  }
}

main().catch((err) => {
  const e = err instanceof Error ? err : new Error(String(err));
  console.error(e.message);
  process.exit(1);
});

