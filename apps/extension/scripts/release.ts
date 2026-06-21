// Copyright (C) 2026 Index
// Kiln - a quality-of-life browser extension for Polytoria.com
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.

import readline from "node:readline/promises";
import { $ } from "bun";

const root = `${import.meta.dir}/..`;
const repoRoot = (
	await $`git rev-parse --show-toplevel`.cwd(`${import.meta.dir}`).text()
).trim();

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});
const ask = (q: string) => rl.question(q);

function bumpVersion(version: string, part: "major" | "minor" | "patch") {
	const [maj, min, pat] = version.split(".").map(Number);
	if (part === "major") return `${maj + 1}.0.0`;
	if (part === "minor") return `${maj}.${min + 1}.0`;
	return `${maj}.${min}.${pat + 1}`;
}

const pkgPath = `${root}/package.json`;
const pkg = await Bun.file(pkgPath).json();
const currentVersion: string = pkg.version;
console.log(`\nCurrent version: ${currentVersion}`);

console.log("  1. major");
console.log("  2. minor");
console.log("  3. patch");
const choice = await ask("\nBump type (1/2/3): ");

const bumpMap: Record<string, "major" | "minor" | "patch"> = {
	"1": "major",
	"2": "minor",
	"3": "patch",
	major: "major",
	minor: "minor",
	patch: "patch",
};
const bump = bumpMap[choice.trim().toLowerCase()];
if (!bump) {
	console.error(`Unknown choice "${choice}"`);
	process.exit(1);
}

const newVersion = bumpVersion(currentVersion, bump);
console.log(`\nBumping ${bump}: ${currentVersion} → ${newVersion}`);

const confirmed = await ask("Proceed? (y/N): ");
rl.close();
if (confirmed.trim().toLowerCase() !== "y") {
	console.log("Aborted.");
	process.exit(0);
}

pkg.version = newVersion;
await Bun.write(pkgPath, `${JSON.stringify(pkg, null, "\t")}\n`);
console.log(`\n✓ Updated package.json → ${newVersion}`);

const lastTag = (
	await $`git describe --tags --abbrev=0`.cwd(root).text()
).trim();
const logOut = (
	await $`git log ${lastTag}..HEAD --pretty=format:%s`.cwd(root).text()
).trim();
const commits = logOut.split("\n").filter((msg) => {
	if (!msg) return false;
	if (/^[a-z]+\([^)]+\):/.test(msg)) return /^[a-z]+\(extension\):/.test(msg);
	return true;
});
console.log(`✓ ${commits.length} commits since ${lastTag}`);

const changelogPath = `${root}/assets/changelog.md`;
const existing = await Bun.file(changelogPath).text();

const today = new Date().toISOString().slice(0, 10);
const commitLines = commits.map((c) => `- ${c}`).join("\n");
const newEntry = `## v${newVersion} — ${today}\n\n### Highlights\n\n### Commits\n\n${commitLines}\n`;

await Bun.write(changelogPath, `${newEntry}\n${existing}`);
console.log(`✓ Prepended v${newVersion} entry to assets/changelog.md`);
console.log(
	"  → Fill in description and highlights manually before shipping.\n",
);

console.log("Staging all changes...");
await $`git add -A`.cwd(repoRoot);
await $`git commit -m "feat(extension): v${newVersion}"`.cwd(repoRoot);
console.log(`✓ Committed "feat(extension): v${newVersion}"`);

await $`git tag v${newVersion}`.cwd(repoRoot);
console.log(`✓ Tagged v${newVersion}`);

console.log("\nPushing extension mirror...");
await $`bun scripts/deploy-mirror.ts`.cwd(root);

console.log("\nBuilding Chrome zip...");
await $`bun run zip`.cwd(root);

console.log("\nBuilding Firefox zip...");
await $`bun run zip:firefox`.cwd(root);

console.log(`\n✓ Done — v${newVersion} zips are in .output/`);