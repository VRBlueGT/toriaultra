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
import {
	_bookmarkedReplies,
	_bookmarkedThreads,
	_forumImages,
	type BookmarkedReply,
	type BookmarkedThread,
	setForumImageStarred,
} from "@/utils/storage";
import {
	applyKilnDisclosureTitle,
	formatNotificationRelativeTime,
	getConfig,
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

export async function forumImageStarring(showDisclosures: boolean) {
	const images = document.querySelectorAll<HTMLImageElement>(
		".user-forum-content img[src*='/markdown/image/']",
	);
	if (images.length === 0) return;

	const saved = await _forumImages.getValue();
	let starredCount = Object.keys(saved).length;
	const configPromise = getConfig();

	images.forEach((img) => {
		const match = img.getAttribute("src")?.match(/\/markdown\/image\/(\d+)/);
		if (!match) return;
		const imageId = Number(match[1]);

		const wrapper = document.createElement("span");
		wrapper.className = "kiln-image-star-wrapper";
		img.parentElement?.insertBefore(wrapper, img);
		wrapper.appendChild(img);

		const starBtn = document.createElement("button");
		starBtn.type = "button";
		starBtn.className = "btn btn-sm btn-dark kiln-image-star-btn";

		const render = (starred: boolean) => {
			starBtn.classList.toggle("kiln-image-starred", starred);
			starBtn.innerHTML = `<i class="fa${starred ? "s" : "-regular"} fa-star${starred ? " text-warning" : ""}"></i>`;
			applyKilnDisclosureTitle(starBtn, showDisclosures, "Star Image");
		};
		render(imageId in saved);

		starBtn.addEventListener("click", async (event) => {
			event.preventDefault();
			const current = await _forumImages.getValue();
			const next = !(imageId in current);

			if (next) {
				const { limits } = await configPromise;
				if (starredCount >= limits.maxStarredImages) {
					applyKilnDisclosureTitle(
						starBtn,
						showDisclosures,
						`You can only star up to ${limits.maxStarredImages} images.`,
					);
					return;
				}
			}

			await setForumImageStarred(imageId, next);
			starredCount += next ? 1 : -1;
			render(next);
		});

		wrapper.appendChild(starBtn);
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
		case "strong":
		case "b":
			return `__${childNodesToMarkdown(el)}__`;
		case "em":
		case "i":
			return `_${childNodesToMarkdown(el)}_`;
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
		case "img": {
			const imageId = el
				.getAttribute("src")
				?.match(/\/markdown\/image\/(\d+)/)?.[1];
			return imageId ? `[[image:${imageId}]]` : (el.getAttribute("alt") ?? "");
		}
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
		if (!threadId) return;

		const firstCard = document.querySelector(".card");

		const getThreadTitle = (): string =>
			document
				.querySelector('nav[aria-label="breadcrumb"] li[aria-current="page"]')
				?.textContent?.trim() ??
			document.title.replace(" - Polytoria", "").trim();

		let categoryIdPromise: Promise<number | undefined> | undefined;
		const resolveCategoryId = (): Promise<number | undefined> => {
			if (!categoryIdPromise) {
				categoryIdPromise = (async () => {
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
						search: getThreadTitle(),
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
				})();
			}
			return categoryIdPromise;
		};

		const dislikeButton = firstCard?.querySelector<HTMLButtonElement>(
			'[id^="dislike-button-"]',
		);

		if (dislikeButton) {
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
							title: getThreadTitle(),
							url: window.location.pathname,
							bookmarkedAt: new Date().toISOString(),
						},
					});
					render(true);
				}
			});

			dislikeButton.insertAdjacentElement("afterend", button);
		}

		const replyBookmarks = await _bookmarkedReplies.getValue();
		document
			.querySelectorAll<HTMLElement>('.card[id^="reply-"]')
			.forEach((card) => {
				const replyId = Number(card.id.replace("reply-", ""));
				const dropdown = card.querySelector(".dropdown-menu");
				const contentEl = card.querySelector<HTMLElement>(
					".user-forum-content",
				);
				if (!replyId || !dropdown || !contentEl) return;

				const author =
					card
						.querySelector(".forum-user-container .text-truncate a.text-reset")
						?.textContent?.trim() || "Unknown";

				const item = document.createElement("a");
				item.className = "dropdown-item text-primary";
				item.href = "#!";

				const render = (bookmarked: boolean) => {
					item.innerHTML = `<i class="fa${bookmarked ? "s" : "-regular"} fa-bookmark me-1"></i> (Kiln) ${bookmarked ? "Remove Bookmark" : "Bookmark Reply"}`;
				};

				render(replyId in replyBookmarks);

				item.addEventListener("click", async (event) => {
					event.preventDefault();
					const current = await _bookmarkedReplies.getValue();

					if (replyId in current) {
						const { [replyId]: _removed, ...rest } = current;
						await _bookmarkedReplies.setValue(rest);
						render(false);
					} else {
						await _bookmarkedReplies.setValue({
							...current,
							[replyId]: {
								replyId,
								threadId,
								categoryId: await resolveCategoryId(),
								title: getThreadTitle(),
								author,
								content: htmlToMarkdown(contentEl).slice(0, 280),
								bookmarkedAt: new Date().toISOString(),
							},
						});
						render(true);
					}
				});

				dropdown.appendChild(item);
			});

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

	const openReplyBookmark = async (
		replyId: number,
		anchor: HTMLAnchorElement,
		openInNewTab: boolean,
	) => {
		if (anchor.dataset.kilnResolving === "1") return;
		anchor.dataset.kilnResolving = "1";
		anchor.style.opacity = "0.6";

		try {
			const result = await sendMessage("getForumReplyRedirect", replyId);
			if (!result.ok) return;

			const url = new URL(result.data, "https://polytrack.top").href;
			if (openInNewTab) window.open(url, "_blank", "noopener,noreferrer");
			else window.location.href = url;
		} finally {
			delete anchor.dataset.kilnResolving;
			anchor.style.opacity = "";
		}
	};

	const renderReplyBookmarkEntry = (
		bookmark: BookmarkedReply,
		onRemoved: () => void,
	): HTMLElement => {
		const category = CATEGORIES.find((c) => c.id === bookmark.categoryId);
		const preview = bookmark.content.replace(/\s+/g, " ").trim();
		const truncatedPreview =
			preview.length > 140 ? `${preview.slice(0, 137)}...` : preview;

		const entry = document.createElement("div");
		entry.className = "forum-entry";
		if (category) entry.style.borderColor = category.color;
		entry.innerHTML = `
			<div class="row align-items-center">
				<div class="col">
					<a href="#!" class="text-reset" data-kiln="open-reply">
						<h6 class="mb-0">
							<i class="fa-duotone fa-solid fa-reply-all me-1"></i>
							${escapeHtml(bookmark.title || "Untitled thread")}
						</h6>
					</a>
					<div class="text-muted small">By ${escapeHtml(bookmark.author)}${truncatedPreview ? ` &middot; ${escapeHtml(truncatedPreview)}` : ""}</div>
					<small class="text-muted">Bookmarked ${formatNotificationRelativeTime(new Date(bookmark.bookmarkedAt))}</small>
				</div>
				<div class="col-auto">
					<button type="button" class="btn btn-sm btn-outline-danger" data-kiln="remove-bookmark">
						<i class="fas fa-trash"></i>
					</button>
				</div>
			</div>
		`;

		const openLink = entry.querySelector<HTMLAnchorElement>(
			'[data-kiln="open-reply"]',
		)!;
		openLink.addEventListener("click", (event) => {
			event.preventDefault();
			const openInNewTab = event.metaKey || event.ctrlKey || event.shiftKey;
			openReplyBookmark(bookmark.replyId, openLink, openInNewTab);
		});
		entry.addEventListener("auxclick", (event) => {
			if (event.button !== 1) return;
			event.preventDefault();
			openReplyBookmark(bookmark.replyId, openLink, true);
		});

		entry
			.querySelector<HTMLButtonElement>('[data-kiln="remove-bookmark"]')!
			.addEventListener("click", async () => {
				const current = await _bookmarkedReplies.getValue();
				const { [bookmark.replyId]: _removed, ...rest } = current;
				await _bookmarkedReplies.setValue(rest);
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
			<h2 class="text-shadow mb-0">Bookmarks</h2>
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
			const [threadBookmarks, replyBookmarks] = await Promise.all([
				_bookmarkedThreads.getValue(),
				_bookmarkedReplies.getValue(),
			]);

			const entries = [
				...Object.values(threadBookmarks).map((bookmark) => ({
					kind: "thread" as const,
					bookmark,
				})),
				...Object.values(replyBookmarks).map((bookmark) => ({
					kind: "reply" as const,
					bookmark,
				})),
			].sort((a, b) =>
				b.bookmark.bookmarkedAt.localeCompare(a.bookmark.bookmarkedAt),
			);

			resultsContainer.innerHTML = "";

			if (entries.length === 0) {
				resultsContainer.innerHTML = `<div class="text-center text-muted border border-secondary rounded p-2">You haven't bookmarked any threads or replies yet.</div>`;
				return;
			}

			for (const entry of entries) {
				resultsContainer.appendChild(
					entry.kind === "thread"
						? renderBookmarkEntry(entry.bookmark, renderList)
						: renderReplyBookmarkEntry(entry.bookmark, renderList),
				);
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
