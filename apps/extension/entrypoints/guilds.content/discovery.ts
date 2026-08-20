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

export function condensedJoinedGuildsList(showDisclosures: boolean) {
	const container = document.getElementById("guild-categories");
	if (!container) return;

	const divider = container.querySelector("hr");
	if (!divider) return;

	let node = divider.nextElementSibling;
	const cardsToCondense: Element[] = [];
	while (node) {
		const next = node.nextElementSibling;
		if (node.classList.contains("card")) {
			cardsToCondense.push(node);
		}
		node = next;
	}

	if (cardsToCondense.length === 0) return;

	const condensedRow = document.createElement("div");
	condensedRow.className = "guild-icons-condensed d-flex flex-wrap gap-2 mb-2";

	for (const card of cardsToCondense) {
		const anchor = card.querySelector(
			"a.text-reset",
		) as HTMLAnchorElement | null;
		const img = card.querySelector("img") as HTMLImageElement | null;
		const nameEl = card.querySelector(".fw-bold") as HTMLElement | null;
		if (!anchor || !img) continue;

		const guildName = nameEl?.textContent?.trim() ?? "";

		const link = document.createElement("a");
		link.href = anchor.getAttribute("href") ?? "#";
		link.className = "guild-icon-condensed text-reset";
		link.setAttribute("data-bs-toggle", "tooltip");
		link.setAttribute("data-bs-placement", "top");
		link.setAttribute("data-bs-title", guildName);

		const iconImg = document.createElement("img");
		iconImg.src = img.src;
		iconImg.className = "rounded";
		iconImg.width = 48;
		iconImg.height = 48;
		iconImg.style.objectFit = "cover";
		iconImg.style.aspectRatio = "1 / 1";
		iconImg.alt = guildName;

		link.appendChild(iconImg);

		if (showDisclosures) {
			link.style.position = "relative";
			const badge = createKilnDisclosureBadge();
			Object.assign(badge.style, {
				position: "absolute",
				top: "0",
				right: "0",
				fontSize: "0.45rem",
				padding: "1px 3px",
				zIndex: "10",
			});
			link.appendChild(badge);
		}

		condensedRow.appendChild(link);
	}

	divider.insertAdjacentElement("afterend", condensedRow);
	for (const card of cardsToCondense) {
		card.remove();
	}

	sendMessage("registerBootstrapElements");
}
