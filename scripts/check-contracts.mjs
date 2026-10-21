import { spawnSync } from "node:child_process";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("../", import.meta.url)));
const artifacts = [
  { path: "services/api/openapi.json", temporaryName: "openapi.json" },
  { path: "packages/contracts/src/generated/openapi.ts", temporaryName: "openapi.ts" }
];

function isChildOf(parent, target) {
  const child = relative(parent, target);
  return child !== "" && child !== ".." && !child.startsWith(`..${sep}`) && !isAbsolute(child);
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: repositoryRoot, encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} failed (${result.status ?? result.signal}):\n${result.stdout}${result.stderr}`);
  }
}

function normalizedContents(path) {
  return readFileSync(path, "utf8").replace(/\r\n/g, "\n");
}

// An alternate reference root lets isolated verification use copies of the artifacts.
export function checkContracts(referenceRoot = repositoryRoot) {
  const cacheRoot = join(repositoryRoot, ".cache-uv-cortex");
  mkdirSync(cacheRoot, { recursive: true });
  const realCacheRoot = realpathSync(cacheRoot);
  if (!isChildOf(realpathSync(repositoryRoot), realCacheRoot)) {
    throw new Error("The contract-check cache must remain inside the repository.");
  }
  const temporaryRoot = mkdtempSync(join(cacheRoot, "contracts-"));
  const createdRoot = realpathSync(temporaryRoot);
  try {
    const openapi = join(temporaryRoot, "openapi.json");
    const typescript = join(temporaryRoot, "openapi.ts");
    run("uv", [
      "run", "--directory", "services/api", "--frozen", "python",
      "scripts/export_openapi.py", "--output", openapi
    ]);
    run(process.execPath, [
      join(repositoryRoot, "node_modules/openapi-typescript/bin/cli.js"),
      openapi, "--output", typescript
    ]);
    const stale = artifacts.filter((artifact) =>
      normalizedContents(join(referenceRoot, artifact.path))
        !== normalizedContents(join(temporaryRoot, artifact.temporaryName))
    );
    if (stale.length > 0) {
      throw new Error(`Contracts are outdated:\n${stale.map((artifact) => `- ${artifact.path}`).join("\n")}\nRun npm run contracts:generate and review the changes.`);
    }
  } finally {
    const cleanupTarget = realpathSync(temporaryRoot);
    if (cleanupTarget !== createdRoot || dirname(cleanupTarget) !== realCacheRoot
      || !basename(cleanupTarget).startsWith("contracts-") || !isChildOf(realCacheRoot, cleanupTarget)) {
      throw new Error("Refusing to remove a contract-check directory outside its created target.");
    }
    rmSync(cleanupTarget, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    checkContracts();
    console.log("Contracts are up to date.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
