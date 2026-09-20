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

import { sendMessage } from "@/utils/messaging";

export const POLYTORIA_CDN_URL =
	/^https:\/\/cdn\.polytoria\.com\/[A-Za-z0-9._/-]+$/;

export function parseAssetId(raw: string): number | null {
	const match = raw.trim().match(/(\d+)\/?$/) ?? raw.match(/(\d+)/);
	const id = match ? Number(match[1]) : Number.NaN;
	return Number.isInteger(id) && id > 0 ? id : null;
}

/** Polytoria CDN URL for a decal ID or store link, or null when it can't be
 *  resolved. Polytoria moderates every asset, so these need no review. */
export async function resolveDecalUrl(raw: string): Promise<string | null> {
	const id = parseAssetId(raw);
	if (id === null) return null;
	const result = await sendMessage("getItemTexture", id).catch(() => null);
	const url = result?.ok && result.data.success ? result.data.url : undefined;
	return url && POLYTORIA_CDN_URL.test(url) ? url : null;
}
