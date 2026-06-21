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

const tag = (await $`git describe --tags --abbrev=0`.text()).trim();
const log = (await $`git log ${tag}..HEAD --pretty=format:%s`.text()).trim();

const commits = log.split("\n").filter((msg) => {
	if (!msg) return false;
	if (/^[a-z]+\([^)]+\):/.test(msg)) return /^[a-z]+\(extension\):/.test(msg);
	return true;
});

console.error(`\n${commits.length} commits since ${tag}:\n`);
console.log(JSON.stringify(commits, null, "\t"));