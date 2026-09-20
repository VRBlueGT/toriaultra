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

import { addPendingAssetApproval } from "@/utils/storage";
import { getUserDetails } from "@/utils/utilities";

function isPendingReview(card: HTMLElement): boolean {
	const title =
		card.getAttribute("data-bs-original-title") ?? card.getAttribute("title") ?? "";
	if (/pending review/i.test(title)) return true;

	return Array.from(card.querySelectorAll<HTMLElement>(".badge")).some((badge) =>
		/pending review/i.test(badge.textContent ?? ""),
	);
}

function extractAssetId(card: HTMLElement): number | null {
	const link = card.querySelector<HTMLAnchorElement>('a[href^="/store/"]');
	const match = link?.getAttribute("href")?.match(/^\/store\/(\d+)/);
	return match ? Number(match[1]) : null;
}

export async function trackPendingAssetApprovals(): Promise<void> {
	const user = await getUserDetails();
	if (!user) return;

	const cards = document.querySelectorAll<HTMLElement>(".card.mcard");

	for (const card of Array.from(cards)) {
		if (!isPendingReview(card)) continue;

		const assetId = extractAssetId(card);
		if (assetId === null) continue;

		await addPendingAssetApproval(assetId, user.userId);
	}
}
