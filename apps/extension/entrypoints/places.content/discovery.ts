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
import type { PlaceListing } from "@/utils/types";

export async function randomPlace() {
	const searchRow = document.querySelector(
		"#games-carousel + .card .row",
	)! as HTMLElement;

	const row = document.createElement("div");
	row.classList.add("col-12", "col-lg-auto");
	row.innerHTML = `
    <button class="btn btn-secondary" type="button">Random Place</button>
    `;

	const button = row.getElementsByTagName("button")[0]!;
	searchRow.appendChild(row);

	searchRow.style.maxWidth = "1200px";

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

const PLACE_ICON_FALLBACKS = [
	"https://cdn.polytoria.com/static/dft1-xzU-zWxM.png",
	"https://cdn.polytoria.com/static/dft2-DBQ3ipQw.png",
	"https://cdn.polytoria.com/static/dft3-BtyqU0FJ.png",
	"https://cdn.polytoria.com/static/dft4-N_Ef3AQ6.png",
	"https://cdn.polytoria.com/static/dft5-CRPCTPiv.png",
	"https://cdn.polytoria.com/static/dft6-CKhz_MVp.png",
];

function renderPlaceCard(place: PlaceListing): HTMLElement {
	const isEvent = place.placeType === "event";
	const iconUrl = place.iconUrl.includes("placeholders")
		? PLACE_ICON_FALLBACKS[place.id % PLACE_ICON_FALLBACKS.length]
		: place.iconUrl;

	const card = document.createElement("div");
	card.className = `mcard card place-card${!place.isLegacy ? " twopointo-demo-place" : ""} mb-2 me-2`;
	card.style.textAlign = "left";

	card.innerHTML = `
		<div class="card-body">
			<img class="place-card-image kiln-place-icon">
			<div class="flex-grow-1 mx-2 mx-lg-1">
				<div class="mt-2 mb-1 place-card-title">
					<i class="text-muted fas fa-${place.genreIcon}"></i> <span class="kiln-place-name"></span>
				</div>
				<div class="place-card-details">
					<span class="text-muted mx-e"><i class="fas fa-user"></i> ${place.playing}</span>
					<span class="kiln-place-rating"></span>
				</div>
			</div>
		</div>
		${isEvent ? `<div class="event-indication text-light">EVENT</div>` : ""}
		`;

	const icon = card.querySelector<HTMLImageElement>(".kiln-place-icon")!;
	icon.src = iconUrl;
	icon.alt = place.name;

	card.querySelector(".kiln-place-name")!.textContent = place.name;

	const ratingEl = card.querySelector(".kiln-place-rating")!;
	if (place.rating === null) {
		ratingEl.innerHTML = `<span class="text-muted mx-1"><i class="fas fa-thumbs-up"></i> -</span>`;
	} else {
		const span = document.createElement("span");
		span.className = "mx-1";
		span.style.color = `hsl(${place.rating * 120}, 55.3%, 57.1%)`;
		span.innerHTML = `<i class="fas fa-thumbs-up"></i> ${Math.round(place.rating * 100)}%`;
		ratingEl.appendChild(span);
	}

	const link = document.createElement("a");
	link.href = `/places/${place.id}`;

	if (isEvent) {
		const wrapper = document.createElement("div");
		wrapper.className = "event-card";
		wrapper.appendChild(card);
		link.appendChild(wrapper);
	} else {
		link.appendChild(card);
	}

	return link;
}

function readPlacesFilters(page: number) {
	return {
		page,
		search:
			(document.getElementById("search-input") as HTMLInputElement | null)
				?.value ?? "",
		genre:
			(document.getElementById("genre") as HTMLSelectElement | null)?.value ??
			"",
		sort:
			(document.getElementById("sort") as HTMLSelectElement | null)?.value ??
			"",
		branch:
			(document.getElementById("branch") as HTMLSelectElement | null)?.value ??
			"",
	};
}

export function disableInfiniteScrolling() {
	sendMessage("disablePlacesAutoScroll");

	const container = document.getElementById("places-container");
	if (!container) return;

	let page = 1;
	let loading = false;
	let finished = false;

	const button = document.createElement("button");
	button.type = "button";
	button.className = "btn btn-outline-secondary w-100 mb-3";
	button.textContent = "Load More";
	container.insertAdjacentElement("afterend", button);

	const setButtonState = (state: "idle" | "loading" | "error" | "done") => {
		button.disabled = state !== "idle";
		button.innerHTML =
			state === "loading"
				? `<span class="spinner-border spinner-border-sm"></span> Loading...`
				: state === "error"
					? "Failed to load more, click to retry"
					: state === "done"
						? "No more places"
						: "Load More";
	};

	new MutationObserver((records) => {
		if (records.some((record) => record.removedNodes.length > 0)) {
			page = 1;
			finished = false;
			setButtonState("idle");
		}
	}).observe(container, { childList: true });

	button.addEventListener("click", async () => {
		if (loading || finished) return;
		loading = true;
		setButtonState("loading");

		const result = await sendMessage(
			"getPlacesListing",
			readPlacesFilters(page + 1),
		);
		loading = false;

		if (!result.ok) {
			setButtonState("error");
			return;
		}

		page++;
		for (const place of result.data.data) {
			container.appendChild(renderPlaceCard(place));
		}

		finished = result.data.meta.nextPageURL === null;
		setButtonState(finished ? "done" : "idle");
	});
}
