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

import type { PolyTrack } from "@kiln/schemas";
import { sendMessage } from "@/utils/messaging";
import type { ForumSearchFilters } from "@/utils/types";
import {
	formatNotificationRelativeTime,
	getUserDetails,
} from "@/utils/utilities";

export const CATEGORIES = [
	{ id: 1, name: "Polytoria General", color: "#FF5555" },
	{ id: 2, name: "Bugs & Troubleshooting", color: "#FFEE55" },
	{ id: 3, name: "Updates", color: "#FF9255" },
	{ id: 4, name: "Suggestions", color: "#71DE4B" },
	{ id: 5, name: "Off Topic", color: "#797979" },
	{ id: 6, name: "Trading", color: "#33DED4" },
	{ id: 8, name: "Showcase", color: "#DE33C3" },
	{ id: 9, name: "Building", color: "#4d57ee" },
	{ id: 10, name: "Scripting", color: "#7b82e8" },
	{ id: 11, name: "Cobras", color: "#517f37" },
	{ id: 12, name: "Phantoms", color: "#3741ce" },
	{ id: 13, name: "Smeagle", color: "#1aff00" },
];

const HIDDEN_CATEGORY_IDS = [11, 12, 13];

const SORT_OPTIONS = [
	{ value: "relevance", label: "Relevance" },
	{ value: "newest", label: "Newest" },
	{ value: "oldest", label: "Oldest" },
	{ value: "mostReplies", label: "Most replies (threads only)" },
	{ value: "mostViews", label: "Most views (threads only)" },
	{ value: "bestRating", label: "Best rating (threads only)" },
	{ value: "worstRating", label: "Worst rating (threads only)" },
];

const TYPE_OPTIONS = [
	{ value: "both", label: "Both" },
	{ value: "thread", label: "Threads" },
	{ value: "replies", label: "Replies" },
];

const DEFAULT_SORT = "newest";
const DEFAULT_TYPE = "thread";

function getForumBasePath(): string {
	const path = window.location.pathname;
	return path === "/forum" ? "/forum/" : path;
}

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

type Chip = { id: number; label: string };

function renderEntry(
	entry: PolyTrack.ForumEntry,
	seen: boolean = false,
): HTMLElement {
	const resolveReplyLink = async (replyId: number, card: HTMLAnchorElement) => {
		if (card.dataset.kilnResolving === "1") return;
		card.dataset.kilnResolving = "1";
		card.style.opacity = "0.6";

		try {
			const result = await sendMessage("getForumReplyRedirect", replyId);
			if (!result.ok) {
				console.error("[Kiln] Failed to resolve reply link:", result.message);
				return;
			}
			window.location.href = new URL(result.data, "https://polytrack.top").href;
		} finally {
			delete card.dataset.kilnResolving;
			card.style.opacity = "";
		}
	};

	const category = CATEGORIES.find((c) => c.id === entry.categoryId);
	const isReply = entry.kind === "reply";
	const title =
		(isReply ? entry.thread.title : entry.title) || "Untitled thread";
	const preview = entry.content.replace(/\s+/g, " ").trim();
	const truncatedPreview =
		preview.length > 100 ? `${preview.slice(0, 97)}...` : preview;

	const card = document.createElement("div");
	card.className = "forum-entry";
	if (seen) card.classList.add("forum-post-read");
	if (category) card.style.borderColor = category.color;

	card.innerHTML = `
		<div class="row">
			<div class="col-3 col-xl-1" style="max-width:84px;">
				<a href="/users/${entry.author.polytoriaId}">
					<img src="${escapeHtml(entry.author.avatarUrl)}" class="rounded-circle bg-dark" style="width: 100%">
				</a>
			</div>
			<div class="col col-xl d-flex flex-wrap align-content-center">
				<div class="mb-0 w-100">
					<a data-kiln="thread-link" class="text-reset">
						<h6 class="mb-0">
							${isReply ? '<i class="fa-duotone fa-solid fa-reply-all"></i>' : ""}
							${escapeHtml(title)}
						</h6>
					</a>
				</div>
				<div class="mb-0 w-100 text-muted">
					<small>
						${truncatedPreview}
					</small>
				</div>
				<div class="mb-0 w-100 text-muted">
					<small>
						By <a class="userlink-default" href="/users/${entry.author.polytoriaId}">${escapeHtml(entry.author.username)}</a> • ${formatNotificationRelativeTime(new Date(entry.postedAt))}
					</small>
				</div>
			</div>
			<div class="col-1 text-center d-flex flex-wrap align-content-center">
				<div class="w-100">
					<small class="text-muted" style="opacity:1;">
						<i class="fas fa-messages me-1"></i>
						${entry.thread.replyCount || "-"}
					</small>
				</div>
			</div>
			<div class="d-none d-xl-flex col-1 text-center flex-wrap align-content-center">
				<div class="w-100">
					<small class="text-muted">
						<i class="fas fa-eye me-1"></i>
						${entry.thread.viewCount || "-"}
					</small>
				</div>
			</div>
		</div>
	`;

	const threadLink = card.querySelector(
		'[data-kiln="thread-link"',
	) as HTMLAnchorElement;
	if (HIDDEN_CATEGORY_IDS.includes(entry.categoryId)) {
		threadLink.href = "#";
		card.addEventListener("click", (event) => {
			event.preventDefault();
			sendMessage("showHiddenCategoryAlert");
		});
	} else if (isReply) {
		threadLink.href = "#";
		card.addEventListener("click", (event) => {
			event.preventDefault();
			resolveReplyLink(entry.id, threadLink);
		});
	} else {
		threadLink.href = `/forum/post/${entry.id}`;
	}

	return card;
}

function setLoadMoreState(
	button: HTMLButtonElement,
	state: "idle" | "loading" | "error" | "done" | "hidden",
) {
	button.classList.toggle("d-none", state === "hidden");
	button.classList.toggle("d-block", state !== "hidden");
	button.disabled = state === "loading" || state === "done";
	button.innerHTML =
		state === "loading"
			? `<span class="spinner-border spinner-border-sm"></span> Loading...`
			: state === "error"
				? "Failed to load more, click to retry"
				: state === "done"
					? "No more results"
					: "Load More";
}

export async function advancedForumSearch(seenThreads: number[]) {
	if (!new URLSearchParams(window.location.search).has("kiln-adv-search")) {
		const searchForm = document.querySelector<HTMLFormElement>(
			'form[action="/forum/search"]',
		);
		searchForm?.addEventListener("submit", (event) => {
			event.preventDefault();
			const query = new FormData(searchForm).get("q");
			const trimmed = typeof query === "string" ? query.trim() : "";
			const basePath = getForumBasePath();
			const url = trimmed
				? `${basePath}?kiln-adv-search&q=${encodeURIComponent(trimmed)}`
				: `${basePath}?kiln-adv-search`;
			window.history.pushState(null, "", url);
			advancedForumSearch(seenThreads);
		});
		return;
	}

	const originalTitle = document.title;
	document.title = "Kiln Adv. Forum Search";

	const firstCategory = document.querySelector<HTMLElement>(
		".container.p-0.p-md-2.p-lg-3.p-xl-4",
	);
	const container = firstCategory?.closest<HTMLElement>(".container");
	if (!container) {
		console.log("ueghijwf");
		return;
	}

	const existingChildren = Array.from(container.children) as HTMLElement[];
	for (const child of existingChildren) child.style.display = "none";

	const searchBox = document.createElement("div");
	searchBox.className = "forum-category-container mb-3 border-secondary";
	searchBox.innerHTML = `
		<div class="d-flex align-items-center justify-content-between mb-3">
			<h2 class="text-shadow mb-0">Advanced Search</h2>
			<button type="button" class="btn btn-sm btn-outline-secondary" data-kiln="adv-search-back">
				<i class="fas fa-arrow-left me-1"></i>Back to Forum
			</button>
		</div>
	`;
	container.prepend(searchBox);

	const panel = document.createElement("div");
	panel.className = "row g-3";
	panel.innerHTML = `
		<div class="col-lg-8 col-12">
			<label class="small text-muted mb-1 d-block">Text</label>
			<div class="input-group">
				<span class="input-group-text bg-dark"><i class="fas fa-search"></i></span>
				<input type="search" class="form-control" data-kiln="search" placeholder="Search titles and post content">
			</div>
		</div>
		<div class="col-lg-4 col-12">
			<label class="small text-muted mb-1 d-block">Sort</label>
			<select class="form-select" data-kiln="sort">
					${SORT_OPTIONS.map((o) => `<option value="${o.value}"${o.value === DEFAULT_SORT ? " selected" : ""}>${o.label}</option>`).join("")}
				</select>
		</div>
		<div class="col-lg-6 col-12">
			<label class="small text-muted mb-1 d-block">Posted by</label>
			<div data-kiln="authors-slot"></div>
		</div>
		<div class="col-lg-6 col-12">
			<label class="small text-muted mb-1 d-block">Posted in</label>
			<div data-kiln="categories-slot"></div>
		</div>
		<div class="col-lg-4 col-md-6 col-12">
			<label class="small text-muted mb-1 d-block">Posted after</label>
			<input type="date" class="form-control" data-kiln="posted-after">
		</div>
		<div class="col-lg-4 col-md-6 col-12">
			<label class="small text-muted mb-1 d-block">Posted before</label>
			<input type="date" class="form-control" data-kiln="posted-before">
		</div>
		<div class="col-lg-4 col-md-6 col-12">
			<label class="small text-muted mb-1 d-block">Type</label>
			<select class="form-select" data-kiln="type">
				${TYPE_OPTIONS.map((o) => `<option value="${o.value}"${o.value === DEFAULT_TYPE ? " selected" : ""}>${o.label}</option>`).join("")}
			</select>
		</div>
		<div class="col-12 d-flex flex-column flex-sm-row justify-content-sm-end gap-2">
			<button type="button" class="btn btn-outline-secondary" data-kiln="clear">Clear</button>
			<button type="submit" class="btn btn-primary" data-kiln="submit">
				<i class="fas fa-search me-1"></i>Search
			</button>
		</div>
	`;

	const form = document.createElement("form");
	form.append(panel);
	searchBox.appendChild(form);

	const suggestAuthors = async (text: string): Promise<Chip[]> => {
		const trimmed = text.trim();
		if (trimmed.length < 2) return [];

		const result = await sendMessage("searchUsersByActivity", trimmed);
		if (!result.ok) return [];
		return result.data.map((user) => ({
			id: user.userId,
			label: user.username,
		}));
	};

	const resolveAuthor = async (text: string): Promise<Chip | null> => {
		const trimmed = text.trim();
		if (!trimmed) return null;
		if (/^\d+$/.test(trimmed))
			return { id: Number(trimmed), label: `#${trimmed}` };

		const result = await sendMessage("findUserByUsername", trimmed);
		if (!result.ok) return null;
		return { id: result.data, label: trimmed };
	};

	const resolveCategory = (text: string): Chip | null => {
		const trimmed = text.trim().toLowerCase();
		if (!trimmed) return null;

		const match =
			CATEGORIES.find((category) => category.name.toLowerCase() === trimmed) ??
			CATEGORIES.find((category) =>
				category.name.toLowerCase().includes(trimmed),
			);

		return match ? { id: match.id, label: match.name } : null;
	};

	const suggestCategories = (text: string): Chip[] => {
		const trimmed = text.trim().toLowerCase();
		if (!trimmed) return [];

		return CATEGORIES.filter((category) =>
			category.name.toLowerCase().includes(trimmed),
		).map((category) => ({ id: category.id, label: category.name }));
	};

	const createTokenInput = (
		placeholder: string,
		resolve: (text: string) => Promise<Chip | null> | Chip | null,
		suggest?: (text: string) => Promise<Chip[]> | Chip[],
	) => {
		const container = document.createElement("div");
		container.className = "position-relative";

		const wrapper = document.createElement("div");
		wrapper.className =
			"form-control d-flex flex-wrap align-items-center gap-1 h-auto";
		container.appendChild(wrapper);

		const chipList = document.createElement("div");
		chipList.className = "d-flex flex-wrap gap-1";

		const input = document.createElement("input");
		input.type = "search";
		input.className = "border-0 flex-grow-1 p-0 bg-transparent";
		input.style.outline = "none";
		input.style.minWidth = "140px";
		input.placeholder = placeholder;

		const chips = new Map<number, string>();

		const renderChips = () => {
			chipList.innerHTML = "";
			for (const [id, label] of chips) {
				const chip = document.createElement("span");
				chip.className =
					"badge bg-secondary d-inline-flex align-items-center gap-1";
				chip.append(label);

				const remove = document.createElement("button");
				remove.type = "button";
				remove.className = "btn-close btn-close-black";
				remove.style.fontSize = "0.55em";
				remove.setAttribute("aria-label", "Remove");
				remove.addEventListener("click", () => {
					chips.delete(id);
					renderChips();
				});

				chip.appendChild(remove);
				chipList.appendChild(chip);
			}
			input.placeholder = chips.size === 0 ? placeholder : "Add another";
		};

		const addChip = (chip: Chip) => {
			if (!chips.has(chip.id)) {
				chips.set(chip.id, chip.label);
				renderChips();
			}
			input.value = "";
		};

		let pending = false;
		const tryAdd = async () => {
			const text = input.value;
			if (!text.trim() || pending) return;
			pending = true;
			try {
				const resolved = await resolve(text);
				if (resolved) addChip(resolved);
			} finally {
				pending = false;
				input.value = "";
			}
		};

		let dropdown: HTMLDivElement | null = null;
		if (suggest) {
			dropdown = document.createElement("div");
			dropdown.className =
				"list-group position-absolute w-100 mt-1 shadow-sm d-none";
			dropdown.style.zIndex = "1000";
			dropdown.style.maxHeight = "220px";
			dropdown.style.overflowY = "auto";
			container.appendChild(dropdown);
		}

		const hideSuggestions = () => {
			if (!dropdown) return;
			dropdown.classList.add("d-none");
			dropdown.innerHTML = "";
		};

		let suggestRequestId = 0;
		let debounceTimer: ReturnType<typeof setTimeout> | undefined;
		if (suggest && dropdown) {
			const dropdownEl = dropdown;
			input.addEventListener("input", () => {
				clearTimeout(debounceTimer);
				const text = input.value;
				if (!text.trim()) {
					hideSuggestions();
					return;
				}
				debounceTimer = setTimeout(async () => {
					const requestId = ++suggestRequestId;
					const results = await suggest(text);
					if (requestId !== suggestRequestId) return;
					if (!results.length) {
						hideSuggestions();
						return;
					}

					dropdownEl.innerHTML = "";
					for (const candidate of results) {
						const item = document.createElement("button");
						item.type = "button";
						item.className = "list-group-item list-group-item-action py-1 px-2";
						item.textContent = candidate.label;
						item.addEventListener("mousedown", (event) => {
							event.preventDefault();
							addChip(candidate);
							hideSuggestions();
						});
						dropdownEl.appendChild(item);
					}
					dropdownEl.classList.remove("d-none");
				}, 250);
			});
		}

		input.addEventListener("keydown", (event) => {
			if (event.key === "Enter") {
				event.preventDefault();
				tryAdd();
				hideSuggestions();
			} else if (
				event.key === "Backspace" &&
				input.value === "" &&
				chips.size > 0
			) {
				const lastKey = [...chips.keys()].pop();
				if (lastKey !== undefined) {
					chips.delete(lastKey);
					renderChips();
				}
			}
		});
		input.addEventListener("blur", () => {
			tryAdd();
			hideSuggestions();
		});

		wrapper.append(chipList, input);
		renderChips();

		return {
			element: container,
			getIds: () => [...chips.keys()],
			clear: () => {
				chips.clear();
				renderChips();
				hideSuggestions();
			},
		};
	};

	const authors = createTokenInput(
		"Username or user ID",
		resolveAuthor,
		suggestAuthors,
	);
	const categories = createTokenInput(
		"Category name",
		resolveCategory,
		suggestCategories,
	);
	panel
		.querySelector('[data-kiln="authors-slot"]')!
		.replaceWith(authors.element);
	panel
		.querySelector('[data-kiln="categories-slot"]')!
		.replaceWith(categories.element);

	const resultsContainer = document.createElement("div");
	resultsContainer.className = "kiln-forum-results mt-3";

	const loadMoreButton = document.createElement("button");
	loadMoreButton.type = "button";
	loadMoreButton.className = "btn btn-outline-secondary w-100 mb-3 d-none";
	loadMoreButton.textContent = "Load More";

	searchBox.insertAdjacentElement("afterend", resultsContainer);
	resultsContainer.insertAdjacentElement("afterend", loadMoreButton);

	searchBox
		.querySelector<HTMLButtonElement>('[data-kiln="adv-search-back"]')!
		.addEventListener("click", () => {
			window.history.pushState(null, "", getForumBasePath());
			document.title = originalTitle;
			searchBox.remove();
			resultsContainer.remove();
			loadMoreButton.remove();
			for (const child of existingChildren) child.style.display = "";
		});

	const searchInput = panel.querySelector<HTMLInputElement>(
		'[data-kiln="search"]',
	)!;
	const sortSelect =
		panel.querySelector<HTMLSelectElement>('[data-kiln="sort"]')!;
	const typeSelect =
		panel.querySelector<HTMLSelectElement>('[data-kiln="type"]')!;
	const postedAfterInput = panel.querySelector<HTMLInputElement>(
		'[data-kiln="posted-after"]',
	)!;
	const postedBeforeInput = panel.querySelector<HTMLInputElement>(
		'[data-kiln="posted-before"]',
	)!;
	const clearButton = panel.querySelector<HTMLButtonElement>(
		'[data-kiln="clear"]',
	)!;

	let nextPage: number | null = null;

	const syncFiltersToUrl = (filters: ForumSearchFilters) => {
		const params = new URLSearchParams(window.location.search);

		if (filters.search) params.set("q", filters.search);
		else params.delete("q");

		if (filters.sort !== DEFAULT_SORT) params.set("sort", filters.sort);
		else params.delete("sort");

		if (filters.type !== DEFAULT_TYPE) params.set("type", filters.type);
		else params.delete("type");

		if (filters.authorIds.length)
			params.set("authorIds", filters.authorIds.join(","));
		else params.delete("authorIds");

		if (filters.categoryIds.length)
			params.set("categoryIds", filters.categoryIds.join(","));
		else params.delete("categoryIds");

		if (filters.postedAfter) params.set("postedAfter", filters.postedAfter);
		else params.delete("postedAfter");

		if (filters.postedBefore) params.set("postedBefore", filters.postedBefore);
		else params.delete("postedBefore");

		const query = params.toString();
		const url = `${window.location.pathname}${query ? `?${query}` : ""}`;
		window.history.replaceState(null, "", url);
	};

	const readFilters = (targetPage: number): ForumSearchFilters => ({
		page: targetPage,
		search: searchInput.value.trim(),
		sort: sortSelect.value,
		type: typeSelect.value,
		authorIds: authors.getIds(),
		categoryIds: categories.getIds(),
		postedAfter: postedAfterInput.value,
		postedBefore: postedBeforeInput.value,
	});

	const runSearch = async () => {
		const filters = readFilters(1);
		syncFiltersToUrl(filters);

		resultsContainer.innerHTML = `<div class="text-center text-muted p-4"><span class="spinner-border spinner-border-sm"></span> Searching...</div>`;
		setLoadMoreState(loadMoreButton, "hidden");

		const result = await sendMessage("getForumSearch", filters);
		if (!result.ok) {
			resultsContainer.innerHTML = `<div class="alert alert-danger">Failed to search forums: ${escapeHtml(result.message)}</div>`;
			return;
		}

		resultsContainer.innerHTML = "";
		if (result.data.entries.length === 0) {
			resultsContainer.innerHTML = `<div class="text-center text-danger border border-danger rounded p-2">No forum entries matched your search.</div>`;
			return;
		}

		for (const entry of result.data.entries) {
			resultsContainer.appendChild(
				renderEntry(entry, seenThreads.includes(entry.threadId)),
			);
		}

		nextPage = result.data.nextPage;
		setLoadMoreState(loadMoreButton, nextPage === null ? "done" : "idle");
	};

	loadMoreButton.addEventListener("click", async () => {
		if (nextPage === null) return;
		setLoadMoreState(loadMoreButton, "loading");

		const result = await sendMessage("getForumSearch", readFilters(nextPage));
		if (!result.ok) {
			setLoadMoreState(loadMoreButton, "error");
			return;
		}

		for (const entry of result.data.entries) {
			resultsContainer.appendChild(
				renderEntry(entry, seenThreads.includes(entry.threadId)),
			);
		}

		nextPage = result.data.nextPage;
		setLoadMoreState(loadMoreButton, nextPage === null ? "done" : "idle");
	});

	form.addEventListener("submit", (event) => {
		event.preventDefault();
		runSearch();
	});

	clearButton.addEventListener("click", () => {
		searchInput.value = "";
		sortSelect.value = DEFAULT_SORT;
		typeSelect.value = DEFAULT_TYPE;
		postedAfterInput.value = "";
		postedBeforeInput.value = "";
		authors.clear();
		categories.clear();
		runSearch();
	});

	const initialQuery = new URLSearchParams(window.location.search).get("q");
	if (initialQuery) searchInput.value = initialQuery;

	runSearch();
}

export function getOrCreateForumToolbar(
	searchForm: HTMLFormElement,
): HTMLDivElement {
	const existing = searchForm.nextElementSibling;
	if (
		existing instanceof HTMLDivElement &&
		existing.dataset.kiln === "forum-toolbar"
	) {
		return existing;
	}

	searchForm.classList.remove("mb-3");

	const toolbar = document.createElement("div");
	toolbar.dataset.kiln = "forum-toolbar";
	toolbar.className = "btn-group w-100 mb-3 mt-2";
	toolbar.setAttribute("role", "group");
	searchForm.insertAdjacentElement("afterend", toolbar);

	return toolbar;
}

export async function myPosts() {
	const searchForm = document.querySelector<HTMLFormElement>(
		'form[action="/forum/search"]',
	);
	if (!searchForm) return;

	const toolbar = getOrCreateForumToolbar(searchForm);

	const button = document.createElement("button");
	button.type = "button";
	button.className = "btn btn-outline-secondary flex-fill w-50";
	button.textContent = "My Posts";
	toolbar.appendChild(button);

	const showMyPosts = async () => {
		const user = await getUserDetails();
		if (!user) return;
		const userId = user.userId;

		const firstCategory = document.querySelector<HTMLElement>(
			".container.p-0.p-md-2.p-lg-3.p-xl-4",
		);
		const container = firstCategory?.closest<HTMLElement>(".container");
		if (!container) return;

		button.style.display = "none";

		const existingChildren = Array.from(container.children) as HTMLElement[];
		for (const child of existingChildren) child.style.display = "none";

		const kilnBadge = document.createElement("span");
		kilnBadge.classList.add("badge", "bg-warning", "mb-2");
		kilnBadge.innerText = "Kiln";

		const header = document.createElement("div");
		header.className = "d-flex align-items-center justify-content-between mb-3";
		header.innerHTML = `
			<h2 class="text-shadow mb-0">My Posts</h2>
			<div class="d-flex align-items-center gap-3">
				<div class="form-check mb-0">
					<input class="form-check-input" type="checkbox" id="kiln-my-posts-replies" data-kiln="my-posts-replies">
					<label class="form-check-label" for="kiln-my-posts-replies">Include replies</label>
				</div>
				<select class="form-select form-select-sm w-auto" data-kiln="my-posts-sort">
					<option value="newest">Newest to oldest</option>
					<option value="oldest">Oldest to newest</option>
				</select>
				<button type="button" class="btn btn-sm btn-outline-secondary" data-kiln="my-posts-back">
					<i class="fas fa-arrow-left me-1"></i>Back to Forum
				</button>
			</div>
		`;
		container.prepend(header);
		container.prepend(kilnBadge);

		const resultsContainer = document.createElement("div");
		resultsContainer.className = "kiln-forum-results mt-3";

		const loadMoreButton = document.createElement("button");
		loadMoreButton.type = "button";
		loadMoreButton.className =
			"btn btn-outline-secondary w-75 mx-auto mt-3 mb-3 d-none";
		loadMoreButton.textContent = "Load More";

		header.insertAdjacentElement("afterend", resultsContainer);
		resultsContainer.insertAdjacentElement("afterend", loadMoreButton);

		header
			.querySelector<HTMLButtonElement>('[data-kiln="my-posts-back"]')!
			.addEventListener("click", () => {
				window.history.pushState(null, "", getForumBasePath());
				kilnBadge.remove();
				header.remove();
				resultsContainer.remove();
				loadMoreButton.remove();
				button.style.display = "";
				for (const child of existingChildren) child.style.display = "";
			});

		const repliesCheckbox = header.querySelector<HTMLInputElement>(
			'[data-kiln="my-posts-replies"]',
		)!;
		const sortSelect = header.querySelector<HTMLSelectElement>(
			'[data-kiln="my-posts-sort"]',
		)!;

		let nextPage: number | null = null;

		const loadPage = async (page: number) => {
			const result = await sendMessage("getForumSearch", {
				page,
				search: "",
				sort: sortSelect.value,
				type: repliesCheckbox.checked ? "both" : DEFAULT_TYPE,
				authorIds: [userId],
				categoryIds: [],
				postedAfter: "",
				postedBefore: "",
			});

			if (!result.ok) {
				if (page === 1) {
					resultsContainer.innerHTML = `<div class="alert alert-danger">Failed to load your posts: ${escapeHtml(result.message)}</div>`;
				} else {
					setLoadMoreState(loadMoreButton, "error");
				}
				return;
			}

			if (page === 1) {
				resultsContainer.innerHTML =
					result.data.entries.length === 0
						? `<div class="text-center text-muted border border-secondary rounded p-2">You haven't posted anything yet.</div>`
						: "";
			}

			for (const entry of result.data.entries) {
				resultsContainer.appendChild(renderEntry(entry));
			}

			nextPage = result.data.nextPage;
			setLoadMoreState(loadMoreButton, nextPage === null ? "done" : "idle");
		};

		const runSearch = async () => {
			resultsContainer.innerHTML = `<div class="text-center text-muted p-4"><span class="spinner-border spinner-border-sm"></span> Loading your posts...</div>`;
			setLoadMoreState(loadMoreButton, "hidden");
			await loadPage(1);
		};

		repliesCheckbox.addEventListener("change", runSearch);
		sortSelect.addEventListener("change", runSearch);

		await runSearch();

		loadMoreButton.addEventListener("click", async () => {
			if (nextPage === null) return;
			setLoadMoreState(loadMoreButton, "loading");
			await loadPage(nextPage);
		});
	};

	button.addEventListener("click", () => {
		window.history.pushState(null, "", `${getForumBasePath()}?my-posts`);
		showMyPosts();
	});

	if (new URLSearchParams(window.location.search).has("my-posts")) {
		await showMyPosts();
	}
}
