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

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const entrypointsDir = `${import.meta.dirname}/../entrypoints`;

const files: string[] = [];
for (const entry of readdirSync(entrypointsDir)) {
	const fullPath = join(entrypointsDir, entry);
	if (entry.endsWith(".content.ts")) {
		files.push(fullPath);
	} else if (entry.endsWith(".content") && statSync(fullPath).isDirectory()) {
		files.push(join(fullPath, "index.ts"));
	}
}

const pathFeatures = new Map<string, Set<string>>();

for (const file of files) {
	const source = readFileSync(file, "utf-8");

	const matchesBlock = source.match(/matches:\s*\[([\s\S]*?)\]/);
	if (!matchesBlock) continue;

	const patterns: string[] = [];
	const patternRe = /["']([^"']+)["']/g;
	let m: RegExpExecArray | null;
	while ((m = patternRe.exec(matchesBlock[1])) !== null) {
		patterns.push(m[1]);
	}
	if (patterns.length === 0) continue;

	const featureRe = /enabled\.includes\(\s*["']([^"']+)["']\s*\)/g;
	while ((m = featureRe.exec(source)) !== null) {
		const id = m[1];
		for (const pattern of patterns) {
			if (!pathFeatures.has(pattern)) pathFeatures.set(pattern, new Set());
			pathFeatures.get(pattern)!.add(id);
		}
	}
}

const result: Record<string, string[]> = {};
for (const [pattern, ids] of [...pathFeatures.entries()].sort()) {
	result[pattern] = [...ids].sort();
}

const content = `// Auto-generated from entrypoints (do not edit manually!)
// Regenerated on every \`bun install\`, \`dev\`, and \`build\`.

export const PATH_FEATURES = ${JSON.stringify(result, null, "\t")} as const;

export type FeaturePath = keyof typeof PATH_FEATURES;
`;

await Bun.write(
	`${import.meta.dirname}/../utils/featurePaths.generated.ts`,
	content,
);

console.log(
	`[gen-feature-paths] ${Object.keys(result).length} paths → utils/featurePaths.generated.ts`,
);
