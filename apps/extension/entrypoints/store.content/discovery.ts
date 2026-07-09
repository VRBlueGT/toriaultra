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

import type { CurrencyCode, StoreListingItem } from "@/utils/types";
import {
	bricksToCurrency,
	createModal,
	parseFormattedNumber,
} from "@/utils/utilities";

export function irlBrickPrice(irlCurrency: CurrencyCode) {
	const addPrice = async (item: HTMLElement) => {
		const brickCounterEl = item.getElementsByClassName("text-success")[0] as
			| HTMLElement
			| undefined;
		if (
			!brickCounterEl?.textContent ||
			brickCounterEl.classList.contains("kiln-irl-price")
		)
			return;

		brickCounterEl.classList.add("kiln-irl-price");

		const brickCount = parseFormattedNumber(brickCounterEl.textContent!);
		const currency = await bricksToCurrency(brickCount, irlCurrency);

		if (currency) {
			const span = document.createElement("span");
			span.classList.add("text-muted");
			span.style.fontSize = "0.7rem";
			span.style.fontWeight = "lighter";
			span.textContent = ` (${currency})`;
			brickCounterEl.appendChild(span);
		}
	};

	const processCard = (item: HTMLElement) => {
		if (!item.classList.contains("store-listing-item")) return;
		addPrice(item);
	};

	const scanExisting = () => {
		for (const item of document.getElementsByClassName("store-listing-item")) {
			processCard(item as HTMLElement);
		}
	};

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", scanExisting);
	} else {
		scanExisting();
	}

	const mutations = new MutationObserver((mutations) => {
		for (const record of mutations) {
			for (const node of record.addedNodes) {
				if (!(node instanceof HTMLElement)) continue;

				processCard(node);

				for (const child of node.getElementsByClassName("store-listing-item")) {
					processCard(child as HTMLElement);
				}
			}
		}
	});

	const storeContainer = document.getElementById("store-items");
	if (storeContainer) {
		mutations.observe(storeContainer, { childList: true, subtree: false });
	} else {
		mutations.observe(document.body, { childList: true, subtree: false });
	}
}

type EventWithItems = {
	id: number;
	slug: string;
	name: string;
	date: string | null;
	link: string | null;
	items: { id: number; name: string; thumbnailUrl: string }[];
};

export async function eventItems() {
	const eventsResult = await sendMessage("getEvents");
	if (!eventsResult.ok || eventsResult.data.data.length === 0) return;

	const allEvents = eventsResult.data.data;

	const EVENTS_PER_PAGE = 4;
	let page = 0;
	const groups: EventWithItems[][] = [];
	let loaded = false;

	const modal = createModal("lg");
	modal.style.padding = "20px";

	modal.innerHTML = `
	<div class="d-flex justify-content-between align-items-center mb-3">
		<h5 class="mb-0" style="color:#fff;"><i class="fad fa-party-horn me-2"></i>Event Items</h5>
		<button class="btn btn-sm btn-secondary" id="p-ei-close">✕</button>
	</div>
	<div id="p-ei-body">
		<div class="text-center text-muted py-4">Loading...</div>
	</div>
	<div class="d-flex justify-content-center mt-3" id="p-ei-pagination" style="display:none!important;"></div>
	<small class="text-muted text-center mt-2 d-block" style="font-size:0.7rem;">feature of Kiln</small>
	`;

	modal
		.querySelector("#p-ei-close")!
		.addEventListener("click", () => modal.close());

	const renderPage = () => {
		const body = modal.querySelector<HTMLElement>("#p-ei-body")!;
		const paginationEl = modal.querySelector<HTMLElement>("#p-ei-pagination")!;

		body.innerHTML = groups[page]
			.map(
				(event) => `
			<div class="row px-1 mb-1">
				<div class="col">
					${event.date ? `<h6 class="text-muted mb-0" style="font-size:0.75rem;">${event.date}</h6>` : ""}
					<h5 class="mb-0" style="color: #bfbfbf">${event.name}</h5>
				</div>
				${
					event.link
						? `<div class="col-auto d-flex align-items-center">
					<a class="text-muted" href="${event.link}" target="_blank">
						<span class="d-none d-lg-inline" style="font-size:0.85rem;">
							${event.link.includes("/places/") ? "Event Place" : "Blog Post"}
						</span>
						<i class="fas fa-angle-right ms-1"></i>
					</a>
				</div>`
						: ""
				}
			</div>
			<div class="card mb-3" style="background:#111;border-color:#333;">
				<div class="card-body p-2">
					<div class="d-flex" style="overflow-x:auto;gap:8px;padding-bottom:4px;">
						${event.items
							.map(
								(item) => `
						<a href="/store/${item.id}" style="flex:0 0 auto;text-decoration:none;">
							<div class="card text-center h-100" style="width:110px;background:#1a1a1a;border-color:#444;">
								<div class="card-body p-2">
									<img src="${item.thumbnailUrl}" style="width:72px;height:72px;object-fit:contain;">
									<div class="mt-1" style="font-size:0.65rem;color:#aaa;line-height:1.2;word-break:break-word;">${item.name}</div>
								</div>
							</div>
						</a>
						`,
							)
							.join("")}
					</div>
				</div>
			</div>
			`,
			)
			.join("");

		paginationEl.style.removeProperty("display");
		paginationEl.innerHTML = `
		<nav>
			<ul class="pagination">
				<li class="page-item ${page === 0 ? "disabled" : ""}">
					<a class="page-link" href="#!" id="p-ei-first">«</a>
				</li>
				<li class="page-item ${page === 0 ? "disabled" : ""}">
					<a class="page-link" href="#!" id="p-ei-prev">‹</a>
				</li>
				<li class="page-item active">
					<a class="page-link"><span id="p-ei-current">${page + 1}</span></a>
				</li>
				<li class="page-item ${page === groups.length - 1 ? "disabled" : ""}">
					<a class="page-link" href="#!" id="p-ei-next">›</a>
				</li>
				<li class="page-item ${page === groups.length - 1 ? "disabled" : ""}">
					<a class="page-link" href="#!" id="p-ei-last">»</a>
				</li>
			</ul>
		</nav>
		`;

		paginationEl.querySelector("#p-ei-first")!.addEventListener("click", () => {
			if (page > 0) {
				page = 0;
				renderPage();
			}
		});
		paginationEl.querySelector("#p-ei-prev")!.addEventListener("click", () => {
			if (page > 0) {
				page--;
				renderPage();
			}
		});
		paginationEl.querySelector("#p-ei-next")!.addEventListener("click", () => {
			if (page < groups.length - 1) {
				page++;
				renderPage();
			}
		});
		paginationEl.querySelector("#p-ei-last")!.addEventListener("click", () => {
			if (page < groups.length - 1) {
				page = groups.length - 1;
				renderPage();
			}
		});
	};

	const loadAll = async () => {
		if (loaded) return;
		loaded = true;

		const results = await Promise.all(
			allEvents.map((e) => sendMessage("getEventItems", e.id)),
		);

		const withItems: EventWithItems[] = allEvents.map((e, i) => ({
			...e,
			items: results[i].ok
				? results[i].data.data.sort((a, b) => a.id - b.id)
				: [],
		}));

		const flat = [...withItems];
		while (flat.length > 0) {
			groups.push(flat.splice(0, EVENTS_PER_PAGE));
		}

		renderPage();
	};

	const button = document.createElement("button");
	button.classList.add("btn", "btn-outline-secondary", "btn-sm");
	button.innerHTML = `<i class="fad fa-party-horn me-1"></i>Event Items`;
	button.addEventListener("click", async () => {
		modal.showModal();
		await loadAll();
	});

	const filterBar = document.querySelector<HTMLElement>(
		".store-filter-bar, #store-filter, .store-search",
	);
	if (filterBar) {
		filterBar.appendChild(button);
	} else {
		Object.assign(button.style, {
			position: "fixed",
			bottom: "20px",
			right: "20px",
			zIndex: "9999",
		});
		document.body.appendChild(button);
	}
}

export async function ownedTags(userId: number) {
	const ownedResult = await sendMessage("getOwnedAssetMap", userId);

	if (!ownedResult.ok) {
		throw new Error(
			"[Kiln] API is disabled, cancelling item owned tags loading..",
		);
	}

	const assetMap = ownedResult.data;

	const owns = (item: HTMLElement) => {
		const itemId = parseInt(item.getAttribute("href")!.split("/")[2], 10);
		const entry = assetMap[itemId];
		if (!entry) return null;
		return {
			isCollectible: entry.isLimited,
			serials: entry.serials.sort((a, b) => a - b),
		};
	};

	const addTag = (
		item: HTMLElement,
		isCollectible: boolean,
		serials: number[],
	) => {
		if (item.querySelector(".kiln-owned-tag")) return;

		const tag = document.createElement("span");
		tag.classList.add(
			"badge",
			isCollectible ? "bg-warning" : "bg-primary",
			"kiln-owned-tag",
		);
		tag.setAttribute(
			"style",
			`
            position: absolute;
            font-size: 0.9rem;
            top: 0px;
            left: 0px;
            padding: 5.5px;
            border-top-left-radius: var(--bs-border-radius-lg) !important;
            border-top-right-radius: 0px;
            border-bottom-left-radius: 0px;
            font-size: 0.65rem;
        `,
		);
		tag.innerHTML = "<i class='fas fa-check'></i><br />owned";

		if (isCollectible && serials.length) {
			tag.setAttribute("data-bs-toggle", "tooltip");
			tag.setAttribute("data-bs-title", serials.map((s) => `#${s}`).join(", "));
		}

		const image = item.getElementsByTagName("img")[0]!;
		image.parentElement!.appendChild(tag);
	};

	const processCard = (item: HTMLElement) => {
		if (!item.classList.contains("store-listing-item")) return;
		const link = item.getElementsByTagName("a")[0]!;
		const owned = owns(link);
		if (owned) addTag(item, owned.isCollectible, owned.serials);
	};

	const scanExisting = () => {
		for (const item of document.getElementsByClassName("store-listing-item")) {
			processCard(item as HTMLElement);
		}
		sendMessage("registerBootstrapElements");
	};

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", scanExisting);
	} else {
		scanExisting();
	}

	const mutations = new MutationObserver((records) => {
		const cards: HTMLElement[] = [];

		for (const record of records) {
			for (const node of record.addedNodes) {
				if (!(node instanceof HTMLElement)) continue;

				if (node.classList.contains("store-listing-item")) {
					cards.push(node);
				} else {
					for (const child of node.getElementsByClassName(
						"store-listing-item",
					)) {
						cards.push(child as HTMLElement);
					}
				}
			}
		}

		if (!cards.length) return;

		requestIdleCallback(() => {
			for (const card of cards) {
				processCard(card);
			}
		});
	});

	const container = document.getElementById("store-items");
	if (container) {
		mutations.observe(container, { childList: true, subtree: true });
	} else {
		mutations.observe(document.body, { childList: true, subtree: true });
	}
}

function parseStorePriceInput(value: string): number | null {
	if (!value) return null;
	const parsed = Number.parseInt(value, 10);
	return Number.isNaN(parsed) ? null : parsed;
}

function readStoreFilters(page: number) {
	const types = [
		...document.querySelectorAll<HTMLElement>(".store-type-btn.active"),
	].map((b) => b.dataset.type!);
	const accessoryTypes = [
		...document.querySelectorAll<HTMLElement>(".store-accessory-btn.active"),
	].map((b) => b.dataset.accessoryType!);

	const selected = (
		document.getElementById("store-sort") as HTMLSelectElement | null
	)?.selectedOptions[0];

	const currency = (
		document.getElementById("store-currency") as HTMLSelectElement | null
	)?.value;
	const search = (
		(document.getElementById("storeSearch") as HTMLInputElement | null)
			?.value ?? ""
	).trim();
	const showOffsale =
		(document.getElementById("show-offsale") as HTMLInputElement | null)
			?.checked ?? false;
	const collectiblesOnly =
		(document.getElementById("hide-non-collectible") as HTMLInputElement | null)
			?.checked ?? false;
	const minPrice = parseStorePriceInput(
		(document.getElementById("store-min-price") as HTMLInputElement | null)
			?.value ?? "",
	);
	const maxPrice = parseStorePriceInput(
		(document.getElementById("store-max-price") as HTMLInputElement | null)
			?.value ?? "",
	);
	const creatorName = (
		(document.getElementById("store-creator-name") as HTMLInputElement | null)
			?.value ?? ""
	).trim();

	return {
		types,
		accessoryTypes,
		currency: currency || undefined,
		page,
		search,
		sort: selected?.dataset.sort ?? "createdAt",
		order: selected?.dataset.order ?? "desc",
		showOffsale,
		collectiblesOnly,
		minPrice,
		maxPrice,
		creatorName,
	};
}

function renderStoreItem(asset: StoreListingItem): HTMLElement {
	const wrapper = document.createElement("div");
	wrapper.className = "me-3 col-auto store-listing-item";

	let ribbon = "";
	if (asset.isLimited) {
		ribbon = `<div class="ribbon ribbon-limited ribbon-top-right"><span><i class="fas fa-star d-inline"></i></span></div>`;
	} else if (asset.freeForPlus) {
		ribbon = `<div class="ribbon ribbon-plusdx ribbon-top-right"><span><i class="pi pi-plusdx"></i></span></div>`;
	} else if (asset.recentlyUploaded) {
		ribbon = `<div class="ribbon ribbon-new ribbon-top-right"><span>New</span></div>`;
	}

	let timer = "";
	let soldOut = false;
	if (asset.onSaleUntil !== null && !(asset.isLimited && asset.isSoldOut)) {
		const diff = new Date(asset.onSaleUntil).getTime() - Date.now();
		if (diff > 0) {
			const days = Math.floor(diff / 86_400_000);
			const hours = Math.floor((diff % 86_400_000) / 3_600_000);
			const minutes = Math.floor((diff % 3_600_000) / 60_000);
			const time =
				days > 0
					? `${days}d`
					: hours > 0
						? `${hours}h`
						: minutes > 0
							? `${minutes}m`
							: "<1m";
			timer = `<span class="text-danger ms-2"><i class="fas fa-clock"></i> ${time}</span>`;
		} else if (!asset.isLimited) {
			soldOut = true;
		}
	}

	const priceParts: string[] = [];
	if (asset.priceInStuds !== null) {
		priceParts.push(
			`<span class="text-studs"><i class="fa-sharp-duotone fa-regular fa-circle-dot me-0"></i> ${asset.priceInStuds.toLocaleString("en-US")}</span>`,
		);
	}
	if (asset.displayPrice !== null) {
		priceParts.push(
			asset.displayPrice === 0
				? `<span class="text-primary fw-bold">Free</span>`
				: `<span class="text-success"><i class="pi pi-brick${asset.isLimited ? "-value" : ""} me-1"></i> ${asset.displayPrice.toLocaleString("en-US")}</span>`,
		);
	}

	let price = soldOut
		? ""
		: priceParts.length === 2
			? asset.priceInStuds !== null && asset.priceInStuds > 10000
				? `${priceParts[0]}<br>${priceParts[1]}`
				: `${priceParts[0]}<span class="ms-2">${priceParts[1]}</span>`
			: (priceParts[0] ?? "");
	if (price.length > 0 && timer.length > 0) price += ` ${timer}`;

	wrapper.innerHTML = `
		<div style="max-width: 200px;">
			<a class="text-reset" href="/store/${asset.id}">
				<div class="card mb-1 p-2">
					${ribbon}
					<img width="192" height="192" class="img-fluid rounded-3 mb-2 kiln-store-thumb">
					<small class="text-muted d-block text-truncate kiln-store-creator" style="font-size: 0.75rem;"></small>
					<h6 class="text-truncate mb-0 kiln-store-name"></h6>
					<small class="d-block text-truncate">${price}</small>
				</div>
			</a>
		</div>
		`;

	const img = wrapper.querySelector<HTMLImageElement>(".kiln-store-thumb")!;
	img.src = asset.thumbnailUrl;
	img.alt = asset.name;

	const creatorEl = wrapper.querySelector(".kiln-store-creator")!;
	if (asset.type === "hat") {
		const label = asset.accessoryType
			? asset.accessoryType
					.replace("headAccessory", "headCover")
					.replace(/\b\w/g, (l) => l.toUpperCase())
					.replace(/([A-Z])/g, " $1")
			: "";
		creatorEl.innerHTML = `<i class="fas fa-hat-wizard"></i> `;
		creatorEl.append(label);
	} else if (asset.type === "tool") {
		creatorEl.innerHTML = `<i class="fas fa-wrench"></i> Tool`;
	} else if (asset.type === "face") {
		creatorEl.innerHTML = `<i class="fas fa-face-smile"></i> Face`;
	} else if (asset.type === "profileTheme") {
		creatorEl.innerHTML = `<i class="fas fa-brush"></i> Profile Theme`;
	} else {
		creatorEl.innerHTML = `<i class="fas fa-user"></i> `;
		const creatorLink = document.createElement("a");
		creatorLink.className = "text-reset";
		creatorLink.href = asset.creatorUrl;
		creatorLink.textContent = asset.creatorName;
		creatorEl.append(creatorLink);
	}

	wrapper.querySelector(".kiln-store-name")!.textContent = asset.name;

	return wrapper;
}

export function disableInfiniteScrolling() {
	const itemsContainer = document.getElementById("store-items");
	if (!itemsContainer) return;

	document.getElementById("store-scroll-target")?.remove();

	let page = 1;
	let loading = false;
	let finished = false;

	const button = document.createElement("button");
	button.type = "button";
	button.className = "btn btn-outline-secondary w-100 mb-3";
	button.textContent = "Load More";
	itemsContainer.insertAdjacentElement("afterend", button);

	const setButtonState = (state: "idle" | "loading" | "error" | "done") => {
		button.disabled = state !== "idle";
		button.innerHTML =
			state === "loading"
				? `<span class="spinner-border spinner-border-sm"></span> Loading...`
				: state === "error"
					? "Failed to load more, click to retry"
					: state === "done"
						? "No more items"
						: "Load More";
	};

	new MutationObserver((records) => {
		if (records.some((record) => record.removedNodes.length > 0)) {
			page = 1;
			finished = false;
			setButtonState("idle");
		}
	}).observe(itemsContainer, { childList: true });

	button.addEventListener("click", async () => {
		if (loading || finished) return;
		loading = true;
		setButtonState("loading");

		const result = await sendMessage(
			"getStoreListing",
			readStoreFilters(page + 1),
		);
		loading = false;

		if (!result.ok) {
			setButtonState("error");
			return;
		}

		page = result.data.meta.currentPage;
		for (const asset of result.data.data) {
			itemsContainer.appendChild(renderStoreItem(asset));
		}

		finished = result.data.meta.currentPage >= result.data.meta.lastPage;
		setButtonState(finished ? "done" : "idle");
	});
}
