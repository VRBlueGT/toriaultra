#!/usr/bin/env bun
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

import { $ } from "bun";

const MIRROR_URL = "https://github.com/indexxing/kiln-extension.git";
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

const COPYRIGHT_HEADER =
	`// Copyright (C) 2026 Index\n` +
	`// Kiln - a quality-of-life browser extension for Polytoria.com\n` +
	`//\n` +
	`// This program is free software: you can redistribute it and/or modify\n` +
	`// it under the terms of the GNU General Public License as published by\n` +
	`// the Free Software Foundation, either version 3 of the License, or\n` +
	`// (at your option) any later version.\n` +
	`//\n` +
	`// This program is distributed in the hope that it will be useful,\n` +
	`// but WITHOUT ANY WARRANTY; without even the implied warranty of\n` +
	`// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the\n` +
	`// GNU General Public License for more details.\n` +
	`//\n` +
	`// You should have received a copy of the GNU General Public License\n` +
	`// along with this program. If not, see <https://www.gnu.org/licenses/>.\n` +
	`\n`;

async function addCopyrightToTree(treeHash: string): Promise<string> {
	const lines = (await $`git ls-tree ${treeHash}`.text())
		.trim()
		.split("\n")
		.filter(Boolean);
	const newEntries: string[] = [];

	for (const line of lines) {
		const tabIdx = line.indexOf("\t");
		const [mode, type, hash] = line.slice(0, tabIdx).split(" ");
		const name = line.slice(tabIdx + 1);

		if (type === "tree") {
			newEntries.push(
				`040000 tree ${await addCopyrightToTree(hash)}\t${name}`,
			);
		} else if (
			type === "blob" &&
			name.endsWith(".ts") &&
			!name.endsWith(".generated.ts")
		) {
			const content = await $`git cat-file blob ${hash}`.text();
			const newContent = content.startsWith("#!")
				? content.replace(/^(#![^\n]*\n)/, `$1${COPYRIGHT_HEADER}`)
				: COPYRIGHT_HEADER + content;
			newEntries.push(
				`${mode} blob ${await gitIn(["hash-object", "-w", "--stdin"], newContent)}\t${name}`,
			);
		} else {
			newEntries.push(`${mode} ${type} ${hash}\t${name}`);
		}
	}

	return gitIn(["mktree"], `${newEntries.join("\n")}\n`);
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
	`040000 tree ${await addCopyrightToTree(extensionTree)}\textension\n`,
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
