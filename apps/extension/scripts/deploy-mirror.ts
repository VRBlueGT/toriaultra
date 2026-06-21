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

#!/usr/bin/env bun
import { $ } from "bun";

const MIRROR_URL = "git@git.indexx.dev:Index/kiln-extension.git";
const EXTENSION_PREFIX = "apps/extension";

const repoRoot = (await $`git rev-parse --show-toplevel`.text()).trim();
process.chdir(repoRoot);

async function gitIn(args: string[], input: string): Promise<string> {
	const proc = Bun.spawn(["git", ...args], {
		stdin: new Blob([input]),
		stdout: "pipe",
		cwd: repoRoot,
	});
	await proc.exited;
	return (await new Response(proc.stdout).text()).trim();
}

const { version } = await Bun.file(
	`${repoRoot}/${EXTENSION_PREFIX}/package.json`,
).json();

const extensionTree = (
	await $`git rev-parse HEAD:apps/extension`.text()
).trim();
const schemasTree = (
	await $`git rev-parse HEAD:packages/schemas`.text()
).trim();

const appsTree = await gitIn(
	["mktree"],
	`040000 tree ${extensionTree}\textension\n`,
);
const packagesTree = await gitIn(
	["mktree"],
	`040000 tree ${schemasTree}\tschemas\n`,
);

const [gitattrsBlob, gitignoreBlob, readmeBlob, biomeBlob, bunLockBlob] =
	await Promise.all([
		$`git rev-parse HEAD:.gitattributes`.text().then((s) => s.trim()),
		$`git rev-parse HEAD:.gitignore`.text().then((s) => s.trim()),
		$`git rev-parse HEAD:README.md`.text().then((s) => s.trim()),
		$`git rev-parse HEAD:biome.json`.text().then((s) => s.trim()),
		$`git rev-parse HEAD:bun.lock`.text().then((s) => s.trim()),
	]);

const rootPkg = await Bun.file(`${repoRoot}/package.json`).json();
const mirrorPkg = { ...rootPkg, workspaces: ["packages/*", "apps/extension"] };
const pkgBlob = await gitIn(
	["hash-object", "-w", "--stdin"],
	JSON.stringify(mirrorPkg, null, "\t"),
);

const rootTreeInput =
	[
		`040000 tree ${appsTree}\tapps`,
		`040000 tree ${packagesTree}\tpackages`,
		`100644 blob ${gitattrsBlob}\t.gitattributes`,
		`100644 blob ${gitignoreBlob}\t.gitignore`,
		`100644 blob ${readmeBlob}\tREADME.md`,
		`100644 blob ${biomeBlob}\tbiome.json`,
		`100644 blob ${bunLockBlob}\tbun.lock`,
		`100644 blob ${pkgBlob}\tpackage.json`,
	].join("\n") + "\n";

const rootTree = await gitIn(["mktree"], rootTreeInput);

let parentCommit: string | null = null;
try {
	await $`git fetch ${MIRROR_URL} main`.quiet();
	parentCommit = (await $`git rev-parse FETCH_HEAD`.text()).trim();
} catch {}

const newCommit = parentCommit
	? (
			await $`git commit-tree ${rootTree} -p ${parentCommit} -m ${`v${version}`}`.text()
		).trim()
	: (
			await $`git commit-tree ${rootTree} -m ${`v${version}`}`.text()
		).trim();

console.log(`Pushing v${version} to ${MIRROR_URL}...`);
await $`git push ${MIRROR_URL} ${newCommit}:refs/heads/main --force`;

console.log("Mirror complete.");