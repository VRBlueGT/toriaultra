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

import { preferences } from "@/utils/storage";

export default defineContentScript({
	matches: ["https://polytoria.com/rankings*"],
	main() {
		preferences.getPreferences().then((values) => {
			getUserDetails().then((user) => {
				if (!user) {
					console.warn("[Kiln] Failure to get logged in user details.");
					return;
				}

				if (values.enabled.includes("detailedPlaceReviews")) {
					placeReviewLeaderboards();
				}
			});
		});
	},
});

type LeaderboardTabId = "kilntopreviewers" | "kilnratedworldshighest";

function waitForElement<T extends Element>(
	selector: string,
): Promise<T | null> {
	return new Promise((resolve) => {
		const existing = document.querySelector<T>(selector);
		if (existing) {
			resolve(existing);
			return;
		}

		const observer = new MutationObserver(() => {
			const el = document.querySelector<T>(selector);
			if (el) {
				observer.disconnect();
				resolve(el);
			}
		});
		observer.observe(document.body, { childList: true, subtree: true });

		setTimeout(() => {
			observer.disconnect();
			resolve(null);
		}, 15_000);
	});
}

function renderLeaderboardCard(data: {
	href: string;
	thumbnail: string | null;
	name: string;
	rank: number;
	value: string;
	valueColor?: string;
}) {
	return `
		<div class="card mb-2 p-2">
			<div class="row">
				<div class="col-auto">
					<a href="${data.href}">
						<img src="${data.thumbnail ?? ""}" width="72" height="72" class="rounded-circle border border-2 border-secondary">
					</a>
				</div>
				<div class="col d-flex align-items-center">
					<a href="${data.href}" class="text-reset">
						<h5 class="mb-0">${data.name}</h5>
						<h6 class="text-muted mb-0">#${data.rank}</h6>
					</a>
				</div>
				<div class="col-auto d-flex align-items-center"${data.valueColor ? ` style="color:${data.valueColor};font-weight:600;"` : ""}>
					${data.value}
				</div>
			</div>
		</div>
	`;
}

function ratingColor(rating: number): string {
	if (rating >= 4) return "#2ecc71";
	if (rating >= 2.5) return "#f39c12";
	return "#e74c3c";
}

async function placeReviewLeaderboards() {
	const nav = await waitForElement<HTMLElement>("#ranking-category");
	const content = await waitForElement<HTMLElement>("#rankings-content");
	if (!nav || !content) {
		console.warn("[Kiln] Couldn't find rankings tab/content elements.");
		return;
	}
	const spinner = document.getElementById("spinner");

	const tabs: { id: LeaderboardTabId; label: string }[] = [
		{ id: "kilntopreviewers", label: "Top Reviewers" },
		{ id: "kilnratedworldshighest", label: "Highest Rated Worlds" },
	];

	for (const tab of tabs) {
		const li = document.createElement("li");
		li.className = "nav-item";
		li.innerHTML = `<a class="nav-link" href="#!" data-ranking-category="${tab.id}">(Kiln) ${tab.label}</a>`;
		nav.appendChild(li);

		const link = li.querySelector("a")!;
		link.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopImmediatePropagation();
			activateTab(tab.id);
		});
	}

	function setActiveTab(tabId: LeaderboardTabId) {
		nav!.querySelectorAll<HTMLElement>(".nav-link").forEach((el) => {
			el.classList.toggle("active", el.dataset.rankingCategory === tabId);
		});
	}

	const urlCategory = new URL(window.location.href).searchParams.get(
		"category",
	) as LeaderboardTabId | null;
	if (tabs.some((t) => t.id === urlCategory)) {
		activateTab(urlCategory as LeaderboardTabId);
	}

	async function activateTab(tabId: LeaderboardTabId) {
		setActiveTab(tabId);
		sendMessage("setNativeRankingsLoadingPaused", true);

		const url = new URL(window.location.href);
		url.searchParams.set("category", tabId);
		window.history.replaceState({}, "", url);

		if (spinner) spinner.style.display = "";
		content!.innerHTML = "";

		try {
			switch (tabId) {
				case "kilntopreviewers":
					await renderTopReviewers();
					break;
				case "kilnratedworldshighest":
					await renderRatedWorlds();
					break;
			}
		} finally {
			if (spinner) spinner.style.display = "none";
		}
	}

	async function renderTopReviewers() {
		const result = await sendMessage("getTopReviewers");
		if (!result.ok) {
			content!.innerHTML = `<p class="text-muted text-center">Couldn't load the leaderboard.</p>`;
			return;
		}

		content!.innerHTML = result.data.data
			.map((entry, i) =>
				renderLeaderboardCard({
					href: `/users/${entry.userId}`,
					thumbnail: entry.thumbnail,
					name: entry.username,
					rank: i + 1,
					value: `${entry.reviewCount.toLocaleString()} reviews`,
				}),
			)
			.join("");
	}

	async function renderRatedWorlds() {
		const result = await sendMessage("getRatedWorldsLeaderboard", "highest");
		if (!result.ok) {
			content!.innerHTML = `<p class="text-muted text-center">Couldn't load the leaderboard.</p>`;
			return;
		}

		const entries = result.data.data;
		const places = await Promise.all(
			entries.map((entry) => sendMessage("getPlace", entry.placeId)),
		);

		content!.innerHTML = entries
			.map((entry, i) => {
				const placeResult = places[i];
				const place = placeResult.ok ? placeResult.data : null;
				return renderLeaderboardCard({
					href: `/places/${entry.placeId}`,
					thumbnail: place?.thumbnail ?? null,
					name: place?.name ?? `Place ${entry.placeId}`,
					rank: i + 1,
					value: `${entry.averageRating.toFixed(1)} avg. (${entry.reviewCount} reviews)`,
					valueColor: ratingColor(entry.averageRating),
				});
			})
			.join("");
	}
}
