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

import preferences from "../public/preferences.json";

const ids = [...new Set(preferences.preferences.map((p) => p.id))];

const content = `// Auto-generated from public/preferences.json (do not edit manually!)
// Regenerated on every \`bun install\`, \`dev\`, and \`build\`.

export const ALL_FEATURE_IDS = ${JSON.stringify(ids, null, "\t")} as const;

export type FeatureId = (typeof ALL_FEATURE_IDS)[number];
`;

await Bun.write(
	`${import.meta.dirname}/../utils/featureIds.generated.ts`,
	content,
);
console.log(
	`[gen-feature-ids] ${ids.length} IDs → utils/featureIds.generated.ts`,
);