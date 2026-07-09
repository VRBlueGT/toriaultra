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

import config from "@/utils/static/fallbackConfig.json";

export function forumMentions() {
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
				fragment.appendChild(link);

				lastIndex = match.index + fullMatch.length;
			}

			fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
			node.parentNode?.replaceChild(fragment, node);
		});
	});
}

export function aiBotForumWarnings() {
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
			tag.textContent =
				"This content may have been generated using AI. This information may not be factual.";
			textBlock.appendChild(tag);
		}
	});
}
