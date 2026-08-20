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

import { kilnDisclosureBadgeHtml } from "@/utils/utilities";

export async function userLabels(
	inactiveDays: number,
	ogYear: number,
	showDisclosures: boolean,
) {
	const container = document.querySelector<HTMLElement>(
		".col-12:has(.user-entry)",
	);
	if (!container) return;

	const processed = new Set<number>();
	const OG_CUTOFF = `${ogYear + 1}-01-01`;

	const processEntries = async (entries: Element[]) => {
		const batch: { userId: number; nameLink: Element }[] = [];

		for (const entry of entries) {
			const userId = parseInt(entry.getAttribute("data-user-id") ?? "", 10);
			if (!userId || Number.isNaN(userId) || processed.has(userId)) continue;
			const nameLink = entry.querySelector("a.text-reset.text-decoration-none");
			if (!nameLink) continue;
			processed.add(userId);
			batch.push({ userId, nameLink });
		}

		for (let i = 0; i < batch.length; i += 5) {
			const chunk = batch.slice(i, i + 5);
			const result = await sendMessage("checkUserActivity", {
				userIds: chunk.map((c) => c.userId),
				days: inactiveDays,
			});
			if (!result.ok) continue;

			for (const { userId, nameLink } of chunk) {
				const info = result.data[String(userId)];
				if (!info) continue;

				if (!info.active) {
					nameLink.insertAdjacentHTML(
						"afterend",
						`<span class="badge bg-secondary ms-1" style="font-size:0.65rem;vertical-align:middle;" data-bs-toggle="tooltip" data-bs-title="Hasn't been seen online in the last ${inactiveDays} days">Inactive</span>${kilnDisclosureBadgeHtml(showDisclosures)}`,
					);
				}

				if (info.registeredAt && info.registeredAt.slice(0, 10) < OG_CUTOFF) {
					nameLink.insertAdjacentHTML(
						"afterend",
						`<span class="badge bg-warning text-dark ms-1" style="font-size:0.65rem;vertical-align:middle;" data-bs-toggle="tooltip" data-bs-title="Joined during ${ogYear} or earlier">OG</span>${kilnDisclosureBadgeHtml(showDisclosures)}`,
					);
				}
			}

			sendMessage("registerBootstrapElements");
		}
	};

	processEntries(Array.from(container.querySelectorAll(".user-entry")));

	new MutationObserver((mutations) => {
		const added: Element[] = [];
		for (const m of mutations) {
			for (const node of m.addedNodes) {
				if (node instanceof Element) added.push(node);
			}
		}
		if (added.length) processEntries(added);
	}).observe(container, { childList: true });
}
