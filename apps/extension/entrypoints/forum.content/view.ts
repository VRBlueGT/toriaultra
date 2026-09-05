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
import config from "@/utils/static/fallbackConfig.json";
import { _bookmarkedThreads, type BookmarkedThread } from "@/utils/storage";
import {
	applyKilnDisclosureTitle,
	formatNotificationRelativeTime,
	kilnDisclosureBadgeHtml,
} from "@/utils/utilities";
import { CATEGORIES, getOrCreateForumToolbar } from "./search";

export function forumMentions(showDisclosures: boolean) {
	const textBlocks = document.querySelectorAll("p:not(.text-muted):not(.mb-0)");
	const regex = /@([\w.]+)/g;

	textBlocks.forEach((block) => {
		const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
		const nodes = [];

		let currentNode = walker.nextNode();
		while (currentNode) {
			nodes.push(currentNode);
			currentNode = walker.nextNode();
		}

		nodes.forEach((node) => {
			const text = node.nodeValue || "";
			if (!text.includes("@")) return;

			const fragment = document.createDocumentFragment();
			let lastIndex = 0;

			for (const match of text.matchAll(regex)) {
				const [fullMatch, username] = match;

				fragment.appendChild(
					document.createTextNode(text.slice(lastIndex, match.index)),
				);

				const link = document.createElement("a");
				link.href = `/u/${username}`;
				link.className = "kiln-extension-mention";
				link.textContent = fullMatch;
				applyKilnDisclosureTitle(link, showDisclosures);
				fragment.appendChild(link);

				lastIndex = match.index + fullMatch.length;
			}

			fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
			node.parentNode?.replaceChild(fragment, node);
		});
	});
}

export async function forumUserLabels(
	inactiveDays: number,
	ogYear: number,
	showDisclosures: boolean,
) {
	const OG_CUTOFF = `${ogYear + 1}-01-01`;

	const batch: { userId: number; nameLink: Element }[] = [];
	document.querySelectorAll(".card").forEach((card) => {
		const nameLink = card.querySelector(
			".forum-user-container .text-truncate a.text-reset",
		);
		if (!nameLink) return;

		const userId = parseInt(
			nameLink.getAttribute("href")?.split("/").pop() ?? "",
			10,
		);
		if (!userId || Number.isNaN(userId)) return;

		batch.push({ userId, nameLink });
	});

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
}

export function aiBotForumWarnings(showDisclosures: boolean) {
	const aiUserSet = new Set(config.users.generativeAI.map(String));
	const cards = document.querySelectorAll(".card");

	cards.forEach((card) => {
		const userLink = card.querySelector(
			'.forum-user-container [href^="/users/"]',
		);
		if (!userLink) return;

		const userId = userLink.getAttribute("href")?.split("/").pop();

		if (userId && aiUserSet.has(userId)) {
			const textBlock = card.querySelector(".user-forum-content");
			if (!textBlock) return;

			const tag = document.createElement("span");
			tag.className = "badge bg-secondary d-block mt-2";
			tag.innerHTML = `This content may have been generated using AI. This information may not be factual.${kilnDisclosureBadgeHtml(showDisclosures)}`;
			textBlock.appendChild(tag);
		}
	});
}

export function copyPostContents() {
	const cards = document.querySelectorAll(".card");

	cards.forEach((card) => {
		const contentEl = card.querySelector<HTMLElement>(".user-forum-content");
		const dropdown = card.querySelector(".dropdown-menu");
		if (!contentEl || !dropdown) return;

		const copyItem = document.createElement("a");
		copyItem.className = "dropdown-item text-primary";
		copyItem.href = "#!";
		copyItem.innerHTML = `<i class="fas fa-copy me-1"></i> (Kiln) Copy Markdown`;

		copyItem.addEventListener("click", (e) => {
			e.preventDefault();
			navigator.clipboard
				.writeText(htmlToMarkdown(contentEl))
				.catch(() => alert("Failure to copy post content to clipboard."));
		});

		dropdown.appendChild(copyItem);
	});
}

function htmlToMarkdown(root: HTMLElement): string {
	return childNodesToMarkdown(root)
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

function childNodesToMarkdown(el: Element): string {
	return Array.from(el.childNodes).map(nodeToMarkdown).join("");
}

function nodeToMarkdown(node: Node): string {
	if (node.nodeType === Node.TEXT_NODE) return node.nodeValue ?? "";
	if (node.nodeType !== Node.ELEMENT_NODE) return "";

	const el = node as HTMLElement;
	switch (el.tagName.toLowerCase()) {
		case "br":
			return "\n";
		case "hr":
			return "\n---\n";
		case "em":
		case "i":
			return `*${childNodesToMarkdown(el)}*`;
		case "s":
		case "strike":
		case "del":
			return `~~${childNodesToMarkdown(el)}~~`;
		case "code":
			return el.closest("pre")
				? childNodesToMarkdown(el)
				: `\`${childNodesToMarkdown(el)}\``;
		case "pre": {
			const code = childNodesToMarkdown(el).replace(/\n+$/, "");
			return `\n\`\`\`\n${code}\n\`\`\`\n`;
		}
		case "img":
			return el.getAttribute("alt") ?? "";
		case "h1":
		case "h2":
		case "h3":
		case "h4":
		case "h5":
		case "h6":
			return `\n${"#".repeat(Number(el.tagName[1]))} ${childNodesToMarkdown(el)}\n`;
		case "a":
			return el.classList.contains("kiln-extension-mention")
				? (el.textContent ?? "")
				: el.getAttribute("href") || childNodesToMarkdown(el);
		case "ul":
		case "ol": {
			const items = Array.from(el.children).filter(
				(child) => child.tagName.toLowerCase() === "li",
			);
			const lines = items.map((item, index) => {
				const prefix =
					el.tagName.toLowerCase() === "ul" ? "- " : `${index + 1}. `;
				return prefix + childNodesToMarkdown(item).trim();
			});
			return `\n${lines.join("\n")}\n`;
		}
		case "p":
			return `\n${childNodesToMarkdown(el)}\n`;
		default:
			return childNodesToMarkdown(el);
	}
}

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");
}

function getForumBasePath(): string {
	const path = window.location.pathname;
	return path === "/forum" ? "/forum/" : path;
}

export async function bookmarkedThreads(showDisclosures: boolean) {
	const [, , second, third] = window.location.pathname.split("/");

	if (second === "post") {
		const threadId = Number(third);
		const firstCard = document.querySelector(".card");
		const dislikeButton = firstCard?.querySelector<HTMLButtonElement>(
			'[id^="dislike-button-"]',
		);
		if (!threadId || !dislikeButton) return;

		const button = document.createElement("button");
		button.type = "button";
		button.className = "btn btn-sm btn-outline-secondary ms-2";
		button.setAttribute("aria-label", "Bookmark thread");
		applyKilnDisclosureTitle(button, showDisclosures);

		const render = (bookmarked: boolean) => {
			button.classList.toggle("text-warning", bookmarked);
			button.innerHTML = `<i class="fa${bookmarked ? "s" : "-regular"} fa-bookmark"></i>`;
		};

		render(threadId in (await _bookmarkedThreads.getValue()));

		const resolveCategoryId = async (): Promise<number | undefined> => {
			const authorId = Number(
				firstCard
					?.querySelector<HTMLAnchorElement>(
						'.userlink-default[href^="/users/"]',
					)
					?.getAttribute("href")
					?.split("/")
					.pop(),
			);
			if (!authorId) return undefined;

			const result = await sendMessage("getForumSearch", {
				page: 1,
				search: document.title.replace(" - Polytoria", "").trim(),
				sort: "newest",
				type: "thread",
				authorIds: [authorId],
				categoryIds: [],
				postedAfter: "",
				postedBefore: "",
			});
			if (!result.ok) return undefined;

			return result.data.entries.find((entry) => entry.id === threadId)
				?.categoryId;
		};

		button.addEventListener("click", async () => {
			const current = await _bookmarkedThreads.getValue();

			if (threadId in current) {
				const { [threadId]: _removed, ...rest } = current;
				await _bookmarkedThreads.setValue(rest);
				render(false);
			} else {
				await _bookmarkedThreads.setValue({
					...current,
					[threadId]: {
						threadId,
						categoryId: await resolveCategoryId(),
						title: document.title.replace(" - Polytoria", "").trim(),
						url: window.location.pathname,
						bookmarkedAt: new Date().toISOString(),
					},
				});
				render(true);
			}
		});

		dislikeButton.insertAdjacentElement("afterend", button);
		return;
	}

	if (second && second !== "category") return;

	const searchForm = document.querySelector<HTMLFormElement>(
		'form[action="/forum/search"]',
	);
	if (!searchForm) return;

	const toolbar = getOrCreateForumToolbar(searchForm);

	const button = document.createElement("button");
	button.type = "button";
	button.className = "btn btn-outline-secondary flex-fill w-50";
	button.innerHTML = `Bookmarks${kilnDisclosureBadgeHtml(showDisclosures)}`;
	toolbar.appendChild(button);

	const renderBookmarkEntry = (
		bookmark: BookmarkedThread,
		onRemoved: () => void,
	): HTMLElement => {
		const category = CATEGORIES.find((c) => c.id === bookmark.categoryId);

		const entry = document.createElement("div");
		entry.className = "forum-entry";
		if (category) entry.style.borderColor = category.color;
		entry.innerHTML = `
			<div class="row align-items-center">
				<div class="col">
					<a href="${escapeHtml(bookmark.url)}" class="text-reset">
						<h6 class="mb-0">${escapeHtml(bookmark.title || "Untitled thread")}</h6>
					</a>
					<small class="text-muted">Bookmarked ${formatNotificationRelativeTime(new Date(bookmark.bookmarkedAt))}</small>
				</div>
				<div class="col-auto">
					<button type="button" class="btn btn-sm btn-outline-danger" data-kiln="remove-bookmark">
						<i class="fas fa-trash"></i>
					</button>
				</div>
			</div>
		`;

		entry
			.querySelector<HTMLButtonElement>('[data-kiln="remove-bookmark"]')!
			.addEventListener("click", async () => {
				const current = await _bookmarkedThreads.getValue();
				const { [bookmark.threadId]: _removed, ...rest } = current;
				await _bookmarkedThreads.setValue(rest);
				onRemoved();
			});

		return entry;
	};

	const showBookmarks = async () => {
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
			<h2 class="text-shadow mb-0">Bookmarked Threads</h2>
			<button type="button" class="btn btn-sm btn-outline-secondary" data-kiln="bookmarks-back">
				<i class="fas fa-arrow-left me-1"></i>Back to Forum
			</button>
		`;
		container.prepend(header);
		container.prepend(kilnBadge);

		const resultsContainer = document.createElement("div");
		resultsContainer.className = "kiln-forum-results mt-3";
		header.insertAdjacentElement("afterend", resultsContainer);

		header
			.querySelector<HTMLButtonElement>('[data-kiln="bookmarks-back"]')!
			.addEventListener("click", () => {
				window.history.pushState(null, "", getForumBasePath());
				kilnBadge.remove();
				header.remove();
				resultsContainer.remove();
				button.style.display = "";
				for (const child of existingChildren) child.style.display = "";
			});

		const renderList = async () => {
			const bookmarks = Object.values(await _bookmarkedThreads.getValue()).sort(
				(a, b) => b.bookmarkedAt.localeCompare(a.bookmarkedAt),
			);

			resultsContainer.innerHTML = "";

			if (bookmarks.length === 0) {
				resultsContainer.innerHTML = `<div class="text-center text-muted border border-secondary rounded p-2">You haven't bookmarked any threads yet.</div>`;
				return;
			}

			for (const bookmark of bookmarks) {
				resultsContainer.appendChild(renderBookmarkEntry(bookmark, renderList));
			}
		};

		await renderList();
	};

	button.addEventListener("click", () => {
		window.history.pushState(
			null,
			"",
			`${getForumBasePath()}?bookmarked-threads`,
		);
		showBookmarks();
	});

	if (new URLSearchParams(window.location.search).has("bookmarked-threads")) {
		await showBookmarks();
	}
}
