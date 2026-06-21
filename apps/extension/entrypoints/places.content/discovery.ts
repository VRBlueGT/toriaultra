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

/**
 * Displays a button to roll for a random place.
 */
export async function randomPlace() {
	const searchRow = document.querySelector("#games-carousel + .card .row")!;

	const row = document.createElement("div");
	row.classList.add("col-12", "col-lg-auto");
	row.innerHTML = `
    <button class="btn btn-secondary" type="button" data-bs-toggle="dropdown" aria-expanded="false">Random Place</button>
    `;

	const button = row.getElementsByTagName("button")[0]!;
	searchRow.appendChild(row);

	button.addEventListener("click", async () => {
		button.disabled = true;

		await sendMessage("rollRandomPlace");

		button.disabled = false;
	});
}

export function subtleV2Labels(mode: "minimal" | "legacy") {
	const apply = (card: Element) => {
		const isV2 = card.classList.contains("twopointo-demo-place");
		card.classList.remove("twopointo-demo-place");

		card.querySelector(".kiln-v2-badge")?.remove();

		if (mode === "minimal") {
			if (!isV2) return;

			card.querySelector<HTMLElement>(".twopointo-title")?.remove();

			const badge = document.createElement("span");
			badge.className = "kiln-v2-badge badge bg-primary";
			badge.textContent = "2.0";
			Object.assign(badge.style, {
				position: "absolute",
				top: "0",
				left: "50%",
				translate: "-50%",
				zIndex: "2000",
				fontFamily: "'Varela Round'",
				borderTopLeftRadius: "0px",
				borderTopRightRadius: "0px",
				marginTop: "-3px",
				width: "50%",
				boxShadow: "0 0 3px #00000087",
			});
			card.querySelector(".card-body")?.appendChild(badge);
		} else {
			card.querySelector<HTMLElement>(".twopointo-title")?.remove();

			if (isV2) return;

			const badge = document.createElement("span");
			badge.className = "kiln-v2-badge badge bg-secondary";
			badge.textContent = "Legacy";
			Object.assign(badge.style, {
				position: "absolute",
				top: "0",
				left: "50%",
				translate: "-50%",
				zIndex: "2000",
				fontFamily: "'Varela Round'",
				borderTopLeftRadius: "0px",
				borderTopRightRadius: "0px",
				marginTop: "-3px",
				width: "50%",
				boxShadow: "0 0 3px #00000087",
			});
			card.querySelector(".card-body")?.appendChild(badge);
		}
	};

	document.querySelectorAll<Element>(".place-card").forEach(apply);

	const container = document.querySelector("#places-container");
	if (container) {
		new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				for (const node of mutation.addedNodes) {
					if (!(node instanceof Element)) continue;
					if (node.classList.contains("place-card")) apply(node);
					node.querySelectorAll<Element>(".place-card").forEach(apply);
				}
			}
		}).observe(container, { childList: true, subtree: true });
	}
}