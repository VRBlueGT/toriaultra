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
import metadata from "@/utils/static/metadata.json";
import { _lastViewedPlaces } from "@/utils/storage";
import type { CurrencyCode } from "@/utils/types";
import {
	formatNotificationRelativeTime,
	getConfig,
	markKilnNotificationRead,
	pullKVCache,
} from "@/utils/utilities";

const placeID = +window.location.pathname.split("/")[2];

const MIN_REVIEW_PLAYTIME_MS = 5 * 60 * 1000;

export async function recordPlaceView() {
	const placeResult = await sendMessage("getPlace", placeID);
	if (!placeResult.ok) return;

	const lastViewed = await _lastViewedPlaces.getValue();
	lastViewed[placeID] =
		placeResult.data.updatedAt ?? placeResult.data.createdAt;
	await _lastViewedPlaces.setValue(lastViewed);

	await markKilnNotificationRead(`place-update:${placeID}`);
}

export async function favoritedPlaces(userId: number) {
	const config = await getConfig();

	const button = document.createElement("button");
	button.classList.add("btn", "btn-primary", "btn-sm", "mt-2");
	button.disabled = true;
	button.innerHTML = `
	<i class="fa-regular fa-star me-2"></i><span>Pin</span>
	`;

	const infoCard = document.querySelector(".card-body:has(.fa-calendar)")!;
	infoCard.appendChild(button);

	if (!(await getApiSession(userId))) {
		button.innerHTML = `<i class="fa-regular fa-lock me-2"></i><span>Verify to Pin</span>`;
		button.title = "Verify your Kiln account to pin worlds.";
		return;
	}

	const favResult = await sendMessage("getFavoritedPlaces", userId);
	if (!favResult.ok) {
		throw new Error("[Kiln] Error getting favorited places");
	}

	const placeIDs = favResult.data.map((place) => place.id);

	const update = () => {
		button.classList.value = "btn btn-primary btn-sm mt-2";
		button.disabled = false;
		if (placeIDs.indexOf(placeID) == -1) {
			if (placeIDs.length >= config.limits.maxPinnedWorlds) {
				button.disabled = true;
			}
			button.children[0].classList.value = "fa-regular fa-star";
		} else {
			button.children[0].classList.value = "fa-duotone fa-star";
		}
	};

	button.addEventListener("mouseenter", () => {
		if (placeIDs.indexOf(placeID) != -1) {
			button.classList.add("btn-danger");
			button.classList.remove("btn-primary");
			button.children[0].classList.add("fa-star-half-stroke");
			button.children[0].classList.remove("fa-star");
		}
	});

	button.addEventListener("mouseleave", () => {
		if (placeIDs.indexOf(placeID) != -1) {
			button.classList.add("btn-primary");
			button.classList.remove("btn-danger");
			button.children[0].classList.add("fa-star");
			button.children[0].classList.remove("fa-star-half-stroke");
		}
	});

	update();

	button.addEventListener("click", async () => {
		button.disabled = true;
		const isPinned = placeIDs.indexOf(placeID) != -1;
		const result = await sendMessage(
			isPinned ? "unfavoritePlace" : "favoritePlace",
			{ placeId: placeID, userId },
		);
		if (result.ok) {
			if (placeIDs.indexOf(placeID) == -1) {
				placeIDs.push(placeID);
			} else {
				placeIDs.splice(placeIDs.indexOf(placeID), 1);
			}
		}
		update();
	});
}

export async function approxPlaceRevenue(
	includeIRLRevenue: boolean,
	irlCurrency: CurrencyCode,
) {
	const isOwnedByGuild = !document.querySelector(
		'.place-hero-content a:has([class^="userlink-"])',
	);

	const config = await getConfig();

	const round = (number: number) =>
		Math.round(number / metadata.economy.visitsPerBrick) *
		metadata.economy.visitsPerBrick;
	const infoCard = document.querySelector(".card-body .row:has(.fa-calendar)")!;

	const key = document.createElement("li");
	const value = document.createElement("li");

	key.innerHTML = "Revenue:";
	value.innerHTML = "...";
	value.classList.add(
		config.apiAvailability.public ? "text-success" : "text-muted",
	);

	infoCard.children[0].appendChild(key);
	infoCard.children[1].appendChild(value);

	const revenue = await pullKVCache(
		"placeRevenue",
		`places-${placeID}`,
		async () => {
			const placeResult = await sendMessage("getPlace", +placeID);
			if (!placeResult.ok) return "unavailable";
			const place = placeResult.data;

			const storeResult = await sendMessage("getPlaceGamepasses", +placeID);
			if (!storeResult.ok) return "unavailable";
			const store = storeResult.data;

			const visitorPayout =
				round(place.uniqueVisits) / metadata.economy.visitsPerBrick;

			// TODO: make it rely on the owner of the guild, if it's owned by a guild, for the tax percentage
			let gamepassRevenue = 0;
			if (!isOwnedByGuild) {
				const creatorResult = await sendMessage("getUser", place.creator.id);
				if (!creatorResult.ok) return "unavailable";
				const creator = creatorResult.data;

				for (const gamepass of store.gamepasses) {
					if (gamepass.asset.price) {
						const price = Math.floor(
							gamepass.asset.price -
								gamepass.asset.price *
									metadata.economy.membershipTax[creator.membershipType],
						);
						gamepassRevenue += price * gamepass.asset.sales;
					}
				}
			}

			return visitorPayout + gamepassRevenue;
		},
		300000,
		false,
	);

	if (revenue == "unavailable") {
		value.innerText =
			"Sorry, this feature is currently unavailable! Check back later!";
		throw new Error(
			"[Kiln] API is disabled, cancelling approx. place revenue loading..",
		);
	}

	value.innerHTML = `<i class="pi pi-brick me-2"></i> ~${revenue.toLocaleString()} ${includeIRLRevenue && revenue > 0 ? `<span class="text-muted">(${await bricksToCurrency(revenue, irlCurrency)})</span>` : ""}`;
}

export async function activeChallenges() {
	const getRawTooltip = (el: Element | null) =>
		el?.getAttribute("data-bs-original-title") ||
		el?.getAttribute("data-bs-title") ||
		el?.getAttribute("title") ||
		null;

	const escAttr = (s: string) =>
		s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

	const normalizeGenre = (s: string | null | undefined) =>
		s?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? null;

	const placeGenre = normalizeGenre(
		document
			.querySelector(".card:has(.fa-calendar) .fa-backpack")
			?.closest("li")?.textContent,
	);

	const fetchChallenges = async () => {
		const response = await fetch("https://polytoria.com/");
		const html = await response.text();
		const dom = new DOMParser().parseFromString(html, "text/html");

		const card = dom.querySelector(".daily-challenge-card");
		if (!card) return null;

		const streakBadge = card.querySelector(".challenge-streak-badge");
		const streak = streakBadge
			? {
					active: streakBadge.classList.contains(
						"challenge-streak-badge-active",
					),
					label: streakBadge
						.querySelector(".challenge-streak-badge-label")
						?.textContent.trim(),
					multiplier: streakBadge
						.querySelector(".challenge-streak-badge-multiplier")
						?.textContent.trim(),
					tooltip: getRawTooltip(streakBadge),
				}
			: null;

		const challenges = [...card.querySelectorAll(".row.mx-0")].map((row) => {
			const xpBadgeText =
				row.querySelector(".xp-badge-text")?.textContent.trim() ?? "";
			const xpMatch = xpBadgeText.match(/(\d+)\s*XP/);
			const studsMatch = xpBadgeText.match(/(\d+)/g);
			const isItemReward = !!row.querySelector('img[src*="hat-badge"]');

			const progressBar = row.querySelector(".progress-bar");
			const progressText = progressBar?.textContent.trim() ?? "";
			const progressMatch = progressText.match(/(\d+)\s*\/\s*(\d+)/);

			const expiryBadge = row.querySelector(".badge.bg-danger");
			const expiryTitle =
				expiryBadge?.getAttribute("data-bs-original-title") ?? "";
			const expiryTypeMatch = expiryTitle.match(
				/^(Daily|Weekly|Monthly) challenge/i,
			);
			const expiryDateMatch = expiryTitle.match(/expires (.+?),/i);

			const placeLink = row.querySelector("p a");
			const placeIdMatch = placeLink
				?.getAttribute("href")
				?.match(/\/places\/(\d+)/);

			const genreMatch = (row.querySelector("p")?.textContent ?? "").match(
				/join a place of the ([a-z]+) genre/i,
			);

			const xpBadgeImg = row
				.querySelector(".xp-badge-text")
				?.closest(".position-relative")
				?.querySelector("img")
				?.getAttribute("src");
			const hatBadgeImg = row
				.querySelector('img[src*="hat-badge"]')
				?.getAttribute("src");

			return {
				title: row.querySelector("h6")?.textContent.trim() ?? null,
				description: row.querySelector("p")?.innerHTML.trim() ?? null,
				reward: isItemReward
					? { type: "item", badgeImg: hatBadgeImg ?? null }
					: {
							type: "xp",
							xp: xpMatch ? parseInt(xpMatch[1], 10) : null,
							studs: studsMatch
								? parseInt(studsMatch[studsMatch.length - 1], 10)
								: null,
							badgeImg: xpBadgeImg ?? null,
						},
				place: placeLink
					? {
							id: placeIdMatch ? parseInt(placeIdMatch[1], 10) : null,
							name: placeLink.textContent.trim(),
						}
					: null,
				genre: genreMatch ? genreMatch[1].toLowerCase() : null,
				progress: (() => {
					const claimButton = row.querySelector(
						'button[onclick^="claimChallengeReward"]',
					);
					if (claimButton)
						return {
							completed: false,
							claimable: true,
							current: null,
							total: null,
						};
					const completed =
						progressBar?.classList.contains("bg-success") ?? false;
					return {
						completed,
						claimable: false,
						current: progressMatch ? parseInt(progressMatch[1], 10) : null,
						total: progressMatch ? parseInt(progressMatch[2], 10) : null,
					};
				})(),
				expiry: {
					type: expiryTypeMatch ? expiryTypeMatch[1].toLowerCase() : null,
					date: expiryDateMatch ? expiryDateMatch[1] : null,
					timeLeft: expiryBadge?.textContent.trim() ?? null,
					tooltip: getRawTooltip(expiryBadge),
				},
			};
		});

		return { streak, challenges };
	};

	type ChallengeData = NonNullable<Awaited<ReturnType<typeof fetchChallenges>>>;
	type Challenge = ChallengeData["challenges"][number];

	const renderProgress = (challenge: Challenge) => {
		if (challenge.progress.claimable) {
			return `
				<div class="text-success small mt-1 d-block m-auto">
					<i class="fas fa-check-circle me-1"></i>Completed! Go to your homepage to claim your reward.
				</div>`;
		}
		if (challenge.progress.completed) {
			return `
				<div class="progress-bar progress-bar-striped bg-success" role="progressbar" style="width:100%; font-size:0.8rem;">
					<span><i class="fas fa-check me-1"></i>Completed</span>
				</div>`;
		}
		const current = challenge.progress.current ?? 0;
		const total = challenge.progress.total ?? 1;
		const pct = total > 0 ? (current / total) * 100 : 0;
		return `
			<div class="progress-bar progress-bar-striped bg-primary" role="progressbar" style="width:${pct}%; font-size:0.8rem;">
				${current} / ${total}
			</div>`;
	};

	const renderExpiryBadge = (challenge: Challenge) => {
		if (!challenge.expiry.timeLeft) return "";
		const iconClass =
			challenge.expiry.type === "daily"
				? "fa-sun"
				: challenge.expiry.type === "weekly"
					? "fa-calendar-week"
					: "fa-calendar-alt";
		const tooltip = escAttr(challenge.expiry.tooltip ?? "");
		return `<span class="badge bg-danger bg-gradient px-2 py-1"
			data-bs-toggle="tooltip"
			data-bs-placement="top"
			data-bs-title="${tooltip}">
			<i class="fas ${iconClass} me-1"></i>${challenge.expiry.timeLeft}
		</span>`;
	};

	const buildContent = (freshData: ChallengeData) => {
		const freshFiltered = freshData.challenges.filter(
			(challenge) =>
				challenge.place?.id === placeID ||
				(placeGenre !== null && normalizeGenre(challenge.genre) === placeGenre),
		);

		const streakHTML = freshData.streak?.active
			? `<span class="badge bg-warning text-dark ms-1"
					data-bs-toggle="tooltip"
					data-bs-placement="top"
					data-bs-html="true"
					data-bs-title="${escAttr(freshData.streak.tooltip ?? "")}">
					<i class="fas fa-fire me-1"></i>${freshData.streak.label} ${freshData.streak.multiplier}
				</span>`
			: "";

		const rowsHTML =
			freshFiltered.length === 0
				? `<div class="text-muted small fst-italic">No challenges for this place.</div>`
				: freshFiltered
						.map((challenge) => {
							const badgeHTML =
								challenge.reward.type === "item"
									? `<img src="${challenge.reward.badgeImg}" width="64" height="64">`
									: `<div class="position-relative d-inline-block" style="width:64px;height:64px;">
										<img src="${challenge.reward.badgeImg}" width="64" height="64">
										<span class="position-absolute top-50 start-50 translate-middle fw-bold text-center" style="font-size:.875rem;line-height:1.2;white-space:nowrap;">
											${challenge.reward.xp} XP<br>
											<span class="text-studs"><i class="fa-sharp-duotone fa-regular fa-circle-dot"></i> ${challenge.reward.studs}</span>
										</span>
									</div>`;

							return `
								<div class="d-flex align-items-start gap-3 ${
									freshFiltered.indexOf(challenge) < freshFiltered.length - 1
										? "mb-3"
										: "mb-1"
								}">
									<div class="flex-shrink-0 mt-1">${badgeHTML}</div>
									<div class="flex-grow-1 min-w-0">
										<div class="d-flex justify-content-between align-items-center">
											<span class="fw-bold">${challenge.title}</span>
											${renderExpiryBadge(challenge)}
										</div>
										<div class="text-muted mb-2" style="font-size:0.8rem;">${challenge.description}</div>
										<div class="progress rounded-pill" style="background:#353535;border-radius:999px;height:20px;">
											${renderProgress(challenge)}
										</div>
									</div>
								</div>`;
						})
						.join("");

		return { streakHTML, rowsHTML };
	};

	const card = document.createElement("div");
	card.classList.add("card", "mcard", "mt-2");
	card.innerHTML = `
		<div class="card-header d-flex align-items-center">
			<div class="flex-grow-1">
				<i class="fas fa-tasks me-1"></i> Active Challenges (in this world)
			</div>
			<div class="d-flex align-items-center gap-1">
				<span class="challenges-streak-container"></span>
				<button class="btn btn-sm btn-outline-secondary challenges-refresh-btn" title="Refresh challenges" disabled>
					<i class="fas fa-sync-alt"></i>
				</button>
			</div>
		</div>
		<div class="card-body" style="max-height:300px; overflow-y:auto;">
			<div class="d-flex justify-content-center py-2">
				<div class="spinner-border spinner-border-sm text-secondary" role="status">
					<span class="visually-hidden">Loading...</span>
				</div>
			</div>
		</div>
	`;

	await new Promise<void>((resolve) => setTimeout(resolve, 0));

	const infoColumn = document.querySelector(".card:has(.fa-calendar)")!
		.parentElement!;
	infoColumn.appendChild(card);

	const refreshBtn = card.querySelector<HTMLButtonElement>(
		".challenges-refresh-btn",
	)!;
	const streakContainer = card.querySelector<HTMLElement>(
		".challenges-streak-container",
	)!;
	const cardBody = card.querySelector<HTMLElement>(".card-body")!;

	const showLoading = () => {
		cardBody.innerHTML = `
			<div class="d-flex justify-content-center py-2">
				<div class="spinner-border spinner-border-sm text-secondary" role="status">
					<span class="visually-hidden">Loading...</span>
				</div>
			</div>
		`;
	};

	refreshBtn.addEventListener("click", async () => {
		refreshBtn.disabled = true;
		refreshBtn.innerHTML = `<i class="fas fa-sync-alt fa-spin"></i>`;
		showLoading();
		try {
			const freshData = await fetchChallenges();
			if (freshData) {
				const { streakHTML: newStreakHTML, rowsHTML: newRowsHTML } =
					buildContent(freshData);
				streakContainer.innerHTML = newStreakHTML;
				cardBody.innerHTML = newRowsHTML;
				sendMessage("registerBootstrapElements");
			}
		} finally {
			refreshBtn.disabled = false;
			refreshBtn.innerHTML = `<i class="fas fa-sync-alt"></i>`;
		}
	});

	const data = await fetchChallenges();
	if (!data) {
		cardBody.innerHTML = `<div class="text-muted small fst-italic">Failed to load challenges.</div>`;
		throw new Error("[Kiln] Failed to parse challenges from homepage.");
	}

	const { streakHTML, rowsHTML } = buildContent(data);
	streakContainer.innerHTML = streakHTML;
	cardBody.innerHTML = rowsHTML;
	refreshBtn.disabled = false;
	sendMessage("registerBootstrapElements");
}

export async function playtimeTracking(userId: number) {
	const formatMinutes = (minutes: number) => {
		if (minutes < 60) return `${minutes}mins`;
		const h = Math.floor(minutes / 60);
		const m = minutes % 60;
		return m > 0 ? `${h}hrs ${m}mins` : `${h}hrs`;
	};

	const formatDate = (iso: string) =>
		new Date(iso).toLocaleDateString(undefined, {
			month: "short",
			day: "numeric",
			year: "numeric",
		});

	const fetchActivity = (forceRefresh = false) =>
		sendMessage("getGameActivity", {
			userId,
			gameId: placeID,
			page: 1,
			pageSize: 25,
			forceRefresh,
		});

	const buildContent = (
		data: Extract<
			Awaited<ReturnType<typeof fetchActivity>>,
			{ ok: true }
		>["data"],
	) => {
		const { totalPlaytime, sessions } = data;

		const rowsHTML =
			sessions.length === 0
				? `<div class="text-muted small fst-italic">No sessions recorded for this world yet.</div>`
				: sessions
						.map(
							(session) => `
						<div class="d-flex justify-content-between align-items-center py-1 border-bottom border-secondary" style="font-size:0.85rem;">
							<span class="text-muted">${formatDate(session.startedAt)}${session.isOpen ? ' <span class="badge bg-success ms-1" style="font-size:0.7rem;">Live</span>' : ""}</span>
							<span>${formatMinutes(Math.round(session.duration / 60_000))}</span>
						</div>`,
						)
						.join("");

		const totalMinutes = Math.round(totalPlaytime / 60_000);
		const avgMinutes =
			sessions.length > 0 ? Math.round(totalMinutes / sessions.length) : 0;

		const summaryHTML =
			sessions.length > 0
				? `<div class="small text-muted mb-2">
					<i class="fas fa-chart-bar me-1"></i>avg ${formatMinutes(avgMinutes)}/session
				</div>`
				: "";

		return {
			totalBadge:
				totalMinutes > 0 ? `${formatMinutes(totalMinutes)} total` : "0m total",
			bodyHTML: `${summaryHTML}${rowsHTML}`,
		};
	};

	const card = document.createElement("div");
	card.classList.add("card", "mcard", "mt-2");
	card.innerHTML = `
		<div class="card-header d-flex align-items-center">
			<div class="flex-grow-1">
				<i class="fas fa-clock me-1"></i> Your Playtime
			</div>
			<div class="d-flex align-items-center gap-1">
				<span class="badge bg-primary playtime-total-badge"></span>
				<button class="btn btn-sm btn-outline-secondary playtime-refresh-btn" title="Refresh playtime" disabled>
					<i class="fas fa-sync-alt"></i>
				</button>
			</div>
		</div>
		<div class="card-body playtime-card-body" style="max-height:300px; overflow-y:auto;">
			<div class="d-flex justify-content-center py-2">
				<div class="spinner-border spinner-border-sm text-secondary" role="status">
					<span class="visually-hidden">Loading...</span>
				</div>
			</div>
		</div>
	`;

	await new Promise<void>((resolve) => setTimeout(resolve, 0));

	const infoColumn = document.querySelector(".card:has(.fa-calendar)")!
		.parentElement!;
	infoColumn.appendChild(card);

	const refreshBtn = card.querySelector<HTMLButtonElement>(
		".playtime-refresh-btn",
	)!;
	const totalBadgeEl = card.querySelector<HTMLElement>(
		".playtime-total-badge",
	)!;
	const cardBody = card.querySelector<HTMLElement>(".playtime-card-body")!;

	refreshBtn.addEventListener("click", async () => {
		refreshBtn.disabled = true;
		refreshBtn.innerHTML = `<i class="fas fa-sync-alt fa-spin"></i>`;
		try {
			const result = await fetchActivity(true);
			if (result.ok) {
				const fresh = buildContent(result.data);
				totalBadgeEl.textContent = fresh.totalBadge;
				cardBody.innerHTML = fresh.bodyHTML;
				sendMessage("registerBootstrapElements");
			}
		} finally {
			refreshBtn.disabled = false;
			refreshBtn.innerHTML = `<i class="fas fa-sync-alt"></i>`;
		}
	});

	const initial = await fetchActivity();
	if (!initial.ok) {
		cardBody.innerHTML = `<div class="text-muted small fst-italic">Failed to load playtime.</div>`;
		return;
	}

	const { totalBadge, bodyHTML } = buildContent(initial.data);
	totalBadgeEl.textContent = totalBadge;
	cardBody.innerHTML = bodyHTML;
	refreshBtn.disabled = false;
	sendMessage("registerBootstrapElements");
}

export function achievementsProgressBar() {
	const tabContents = document.getElementById("achievements-tabpane")!;

	const achievements = tabContents.getElementsByClassName("card");
	const earned = tabContents.querySelectorAll(".fad.fa-check-circle").length;

	const percentage = (earned * 100) / achievements.length;
	const percentageDisplay = ((earned * 100) / achievements.length).toFixed(0);

	const progressBar = document.createElement("div");
	progressBar.role = "progressbar";
	progressBar.classList = "progress";
	progressBar.style.background = "#000";
	progressBar.ariaValueNow = percentageDisplay;
	progressBar.ariaValueMin = "0";
	progressBar.ariaValueMax = "100";
	progressBar.innerHTML = `<div class="progress-bar progress-bar-striped ${percentage > 0 ? "text-bg-warning" : "text-bg-dark"}" style="width: ${percentage > 0 ? percentage : 100}%">${percentageDisplay}%</div>`;

	tabContents.prepend(document.createElement("hr"));
	tabContents.prepend(progressBar);
}

export function fadedUnearnedAchievements() {
	const tab = document.getElementById("achievements-tabpane")!;

	for (const achievement of tab.getElementsByClassName("card")) {
		if (!achievement.querySelector(".fad.fa-check-circle")) {
			(achievement as HTMLElement).style.opacity = "0.5";
		}
	}
}

export async function achievementEarnedPercentages() {
	const place = await sendMessage("getPlace", placeID);
	if (!place.ok) return;

	const data = place.data;

	const getDifficultyLabel = (percent: number): string => {
		if (percent >= 90) return "Freebie";
		if (percent >= 80) return "Cake Walk";
		if (percent >= 50) return "Easy";
		if (percent >= 30) return "Moderate";
		if (percent >= 20) return "Challenging";
		if (percent >= 10) return "Hard";
		if (percent >= 5) return "Extreme";
		if (percent >= 1) return "Insane";
		return "Impossible";
	};

	const tab = document.getElementById("achievements-tabpane")!;

	for (const achievement of tab.getElementsByClassName("card")) {
		const ownerText = achievement.getElementsByClassName(
			"text-muted small my-0",
		)[0] as HTMLSpanElement;
		const owners = parseInt(ownerText.innerText.replace(/[^0-9]/g, ""), 10);
		const percentage = ((owners * 100) / data.uniqueVisits).toFixed(2);

		ownerText.innerHTML += ` (${percentage}%, ${getDifficultyLabel(+percentage)}) <i class="fa-solid fa-circle-info" data-bs-toggle="tooltip" data-bs-title="Freebie: 90-100%<br />Cake Walk: 80-89.9%<br />Easy: 50-79.9%<br />Moderate: 30-49.9%<br />Challenging: 20-29.9%<br />Hard: 10-19.9%<br />Extreme: 5-9.9%<br />Insane: 1-4.9%<br />Impossible: 0-0.9%" data-bs-html="true"></i>`;
	}

	sendMessage("registerBootstrapElements");
}

export function attachServerShareButtons(tab: Element) {
	for (const server of tab.getElementsByClassName("card")) {
		const shareBtn = document.createElement("button");
		shareBtn.innerText = "Share Link";
		shareBtn.classList.add("btn", "btn-primary", "btn-sm", "mt-2");

		const joinBtn = server.getElementsByClassName("btn-success")[0]!;
		joinBtn.parentElement!.appendChild(shareBtn);

		shareBtn.addEventListener("click", () => {
			const onclickAttr = joinBtn.getAttribute("onclick") ?? "";
			const match = onclickAttr.match(/joinPlace\((\d+)\)/);
			if (!match) return;

			const serverId = match[1];
			navigator.clipboard.writeText(
				`https://polytoria.com/places/${placeID}?serverId=${serverId}`,
			);

			const original = shareBtn.textContent;
			shareBtn.textContent = "Copied!";
			setTimeout(() => {
				shareBtn.textContent = original;
			}, 2000);
		});
	}
}

export function serverShareLinks() {
	const tab = document.getElementById("servers-tabpane")!;

	attachServerShareButtons(tab);

	const urlServerId = new URLSearchParams(window.location.search).get(
		"serverId",
	);
	if (urlServerId) {
		const joinBtn = tab.querySelector<HTMLElement>(
			`[onclick="joinPlace(${urlServerId})"]`,
		);
		joinBtn?.click();
	}
}

export function creatorCommentLabels(creatorId: string) {
	const container = document.getElementById("comments")!;

	const tag = (Card: Element): void => {
		const usernameElement = Card.querySelector<HTMLAnchorElement>(
			'.text-reset[href^="/users/"]',
		);
		if (!usernameElement) return;

		if (usernameElement.getAttribute("href")?.split("/")[2] != creatorId)
			return;

		const badge = document.createElement("span");
		badge.classList.add("badge", "bg-primary");
		badge.style.marginLeft = "5px";
		badge.style.verticalAlign = "text-top";
		badge.innerText = "CREATOR";

		badge.setAttribute("data-bs-toggle", "tooltip");
		badge.setAttribute("data-bs-title", "This user created this world.");

		usernameElement.appendChild(badge);
		sendMessage("registerBootstrapElements");
	};

	Array.from(container.children).forEach(tag);

	new MutationObserver((Records) => {
		for (const Record of Records)
			for (const Node of Record.addedNodes)
				if (Node instanceof Element && Node.classList.contains("card"))
					tag(Node);
	}).observe(container, { attributes: false, childList: true, subtree: false });
}

export function legacyPlaceViewLayout(): void {
	const container = document.querySelector<HTMLElement>(
		'div[style*="min-height: 60vh"]',
	);
	if (!container) return;

	const isCreator =
		document.querySelector('[onclick="launchCreator()"]') != null;

	const hero = container.querySelector<HTMLElement>(".place-hero");
	if (!hero) return;

	const title =
		hero.querySelector<HTMLElement>(".place-hero-title")?.textContent?.trim() ??
		"";
	const creatorAnchor = hero.querySelector<HTMLAnchorElement>(
		'.place-hero-details a[href*="/users/"], .place-hero-details a[href*="/guilds/"]',
	);
	const creatorName = creatorAnchor?.textContent?.trim() ?? "";
	const creatorHref = creatorAnchor?.getAttribute("href") ?? "#!";

	const carouselEl = container.querySelector<HTMLElement>(
		"#game-thumbnails-carousel",
	);

	const aboutBody =
		container.querySelector<HTMLElement>(
			'.card-body[style*="max-height:300px"]',
		)?.innerHTML ?? "";

	const infoCardBody =
		container.querySelector<HTMLElement>(".card-header + .card-body .row")
			?.outerHTML ?? "";

	const commentsBlock = container.querySelector<HTMLElement>("#\\#comments");

	const ratingsContainer =
		container.querySelector<HTMLElement>(".ratings-container");
	const likesDataContainer = document.getElementById("likes-data-container");

	const leftCol = document.createElement("div");
	leftCol.className = "col-12 col-xl-7 mb-2";

	const carouselCard = document.createElement("div");
	carouselCard.className = "card mcard mb-2";
	const carouselBody = document.createElement("div");
	carouselBody.className = "card-body p-2";
	if (carouselEl) carouselBody.appendChild(carouselEl);
	carouselCard.appendChild(carouselBody);
	leftCol.appendChild(carouselCard);

	if (commentsBlock) {
		leftCol.appendChild(commentsBlock);
	}

	const rightCol = document.createElement("div");
	rightCol.className = "col";

	rightCol.insertAdjacentHTML(
		"beforeend",
		`<div class="card mcard">
      <div class="card-header">
        <h1 class="my-0" style="font-weight:800;font-size:1.6em">${title}</h1>
      </div>
      <div class="card-body p-2">
        <div class="row">
          <div class="col-auto px-1">
            <a class="p-0 ps-2" role="button">
              <div class="kiln-creator-avatar rounded-circle border border-2 border-secondary d-inline-flex align-items-center justify-content-center bg-secondary" style="width:56px;height:56px;">
                <div class="spinner-border spinner-border-sm text-light" role="status">
                  <span class="visually-hidden">Loading...</span>
                </div>
              </div>
            </a>
          </div>
          <div class="col px-2 mt-1">
            <div class="text-muted fw-bold">
              <i style="width:1.3em" class="text-center text-muted fas fa-planet-ringed me-1"></i>
              Polytoria Place
            </div>
            <div class="text-muted">
              By <a href="${creatorHref}">${creatorName}</a>
            </div>
          </div>
        </div>
      </div>
    </div>`,
	);

	const buttonContainer = document.createElement("div");
	buttonContainer.className = "row px-3 px-lg-2";
	buttonContainer.innerHTML = `
      <div class="col px-1">
        <button class="btn btn-lg btn-game w-100 my-2" id="btn-play">
          <i class="fas fa-play"></i>
        </button>
      </div>
      ${
				isCreator
					? `
      <div class="col-auto px-1">
        <button style="font-size:20px;padding:9px;" class="px-5 btn btn-lg btn-outline-info my-2" data-bs-toggle="tooltip" data-bs-placement="top" id="btn-edit" onclick="launchCreator()" aria-label="Edit this world in Polytoria Creator" data-bs-original-title="Edit this world in Polytoria Creator">
          <i class="fad fa-wrench-simple"></i>
        </button>
      </div>
      <div class="col-auto px-1 manage-btn-wrapper">
        <a href="/create/place/${placeID}" class="btn btn-lg btn-secondary px-4 my-2" style="padding:9px 14px; min-width:110px; display:none;" data-bs-toggle="tooltip" data-bs-placement="top" aria-label="World settings" data-bs-original-title="World settings" id="manage-btn">
          <i class="fas fa-gear"></i>
        </a>
      </div>`
					: ""
			}
    `;
	rightCol.appendChild(buttonContainer);

	if (isCreator) {
		const manageBtn = buttonContainer.querySelector<HTMLElement>("#manage-btn");
		fetch(`/create/place/${placeID}`)
			.then((res) => {
				if (res.ok && manageBtn) {
					manageBtn.style.display = "";
				}
			})
			.catch(() => {});
	}

	if (ratingsContainer) {
		ratingsContainer.classList.add("mb-2");
		rightCol.appendChild(ratingsContainer);
	}

	if (likesDataContainer) {
		rightCol.appendChild(likesDataContainer);
	}

	if (aboutBody.length > 0) {
		rightCol.insertAdjacentHTML(
			"beforeend",
			`<div class="card mcard mb-2">
      <div class="card-header">
        <i class="fas fa-info-circle"></i> About
      </div>
      <div class="card-body p-3 small" style="max-height:300px; overflow-y:auto;">
        ${aboutBody}
      </div>
    </div>`,
		);
	}

	const tempDiv = document.createElement("div");
	tempDiv.innerHTML = infoCardBody;

	tempDiv.querySelectorAll<HTMLLIElement>("li").forEach((li) => {
		if (
			li.textContent?.toLowerCase().includes("revenue") ||
			li.querySelector(".pi-brick")
		) {
			li.remove();
		}
	});

	rightCol.insertAdjacentHTML(
		"beforeend",
		`<div class="card mcard">
      <div class="card-header">
        <i class="fas fa-chart-bar"></i> Info
      </div>
      <div class="card-body p-3 small">
        ${tempDiv.innerHTML}
      </div>
    </div>`,
	);

	const mainRow = document.createElement("div");
	mainRow.className = "row";
	mainRow.appendChild(leftCol);
	mainRow.appendChild(rightCol);

	const breadcrumb = document.createElement("div");
	breadcrumb.innerHTML = `
    <div class="row mt-1 px-2 mt-lg-0">
      <div class="col-auto">
        <nav aria-label="breadcrumb">
          <ol class="breadcrumb">
            <li class="breadcrumb-item">
              <a class="text-muted" href="/places">
                <i class="fad fa-planet-ringed me-1"></i> Places
              </a>
            </li>
            <li class="breadcrumb-item">
              <a class="text-muted" href="/places">
                <i class="fas fa-planet-ringed me-1"></i> Other Places
              </a>
            </li>
            <li class="breadcrumb-item active" aria-current="page">
              <span class="text-light">${title}</span>
            </li>
          </ol>
        </nav>
      </div>
    </div>
    <hr class="mb-lg-5 mt-0">
  `;

	const outerContainer = document.createElement("div");
	outerContainer.className = "container p-0 p-lg-5 py-3 py-lg-4";

	outerContainer.appendChild(breadcrumb);
	outerContainer.appendChild(mainRow);

	const toastContainer =
		container.querySelector<HTMLElement>(".toast-container");

	while (container.firstChild) container.removeChild(container.firstChild);

	if (toastContainer) container.appendChild(toastContainer);
	container.appendChild(outerContainer);

	(async () => {
		const placeResult = await sendMessage("getPlace", placeID);
		if (!placeResult.ok) return;
		const placeholder = outerContainer.querySelector<HTMLElement>(
			".kiln-creator-avatar",
		);
		if (!placeholder) return;
		const img = document.createElement("img");
		img.height = 56;
		img.width = 56;
		img.src = placeResult.data.creator.thumbnail;
		img.className = "rounded-circle border border-2 border-secondary";
		placeholder.replaceWith(img);
	})();

	const mobileNav = document.querySelector<HTMLElement>(".mobile-nav-bottom");
	if (mobileNav) container.appendChild(mobileNav);

	document.getElementById("btn-play")?.addEventListener("click", async () => {
		sendMessage("joinPlace", {
			placeId: placeID,
			version: document.querySelector(".badge .fa-gamepad") ? 2 : 1,
		});
	});
}

function waitForPlaceTabs(): Promise<{
	tabList: HTMLElement;
	tabContent: Element;
} | null> {
	return new Promise((resolve) => {
		const tryResolve = () => {
			const tabList = document.getElementById("place-tabs");
			const tabContent = document.querySelector(".card-body.tab-content");
			if (tabList && tabContent) {
				resolve({ tabList, tabContent });
				return true;
			}
			return false;
		};

		if (tryResolve()) return;

		const observer = new MutationObserver(() => {
			if (tryResolve()) observer.disconnect();
		});
		observer.observe(document.body, { childList: true, subtree: true });

		setTimeout(() => {
			observer.disconnect();
			resolve(null);
		}, 15_000);
	});
}

export async function detailedPlaceReviews(userId: number) {
	const elements = await waitForPlaceTabs();
	if (!elements) return;
	const { tabList, tabContent } = elements;

	const isVerified = !!(await getApiSession(userId));

	const renderStars = (rating: number, interactive = false) => {
		let html = "";
		for (let i = 1; i <= 5; i++) {
			const filled = i <= rating;
			html += `<i class="${filled ? "fas" : "far"} fa-star${interactive ? " kiln-review-star" : ""}" data-star="${i}" style="cursor:${interactive ? "pointer" : "default"};color:${filled ? "#f0b429" : "#aaa"};margin-right:2px;"></i>`;
		}
		return html;
	};

	const renderTimestamp = (iso: string) => {
		const date = new Date(iso);
		const absolute = date.toLocaleString(undefined, {
			month: "short",
			day: "numeric",
			year: "numeric",
			hour: "numeric",
			minute: "2-digit",
		});
		return `<span data-bs-toggle="tooltip" data-bs-placement="top" data-bs-original-title="${absolute}">${formatNotificationRelativeTime(date)}</span>`;
	};

	interface ReviewReply {
		id: string;
		reviewId: string;
		userId: number;
		username: string;
		thumbnail: string | null;
		body: string;
		createdAt: string;
		updatedAt: string;
	}

	const renderReplyRow = (reply: ReviewReply, creatorId: number | null) => {
		const date = renderTimestamp(reply.createdAt);

		return `
			<div class="d-flex align-items-start gap-2 mt-2 ps-3 border-start border-secondary" data-reply-id="${reply.id}">
				<img src="${reply.thumbnail ?? ""}" alt="${reply.username}" class="rounded-circle border border-secondary" width="28" height="28">
				<div class="flex-grow-1">
					<div class="small">
						<a href="/u/${reply.username}" class="text-reset"><span class="userlink-default">${reply.username}</span></a>
						${
							creatorId !== null && reply.userId === creatorId
								? `<span class="badge bg-primary" style="margin-left:5px;vertical-align:text-top;" data-bs-toggle="tooltip" data-bs-title="This user created this world.">CREATOR</span>`
								: ""
						}
						<span class="text-muted ms-1">${date}</span>
					</div>
					<div class="small">${reply.body}</div>
					${
						reply.userId === userId
							? `<button class="btn btn-link btn-sm p-0 text-danger kiln-reply-delete" data-reply-id="${reply.id}">Delete</button>`
							: ""
					}
				</div>
			</div>
			`;
	};

	const renderRepliesSection = (
		review: {
			id: string;
			replies: ReviewReply[];
		},
		creatorId: number | null,
	) => `
		<div class="mt-2 pt-2 border-top border-secondary kiln-review-replies">
			${review.replies.map((reply) => renderReplyRow(reply, creatorId)).join("")}
			<div class="d-flex gap-2 mt-2">
				<textarea class="form-control form-control-sm bg-dark text-light border-secondary kiln-reply-textarea" rows="1" placeholder="Write a reply..." style="resize:vertical;font-size:0.8rem;" data-review-id="${review.id}"></textarea>
				<button class="btn btn-primary btn-sm kiln-reply-submit" data-review-id="${review.id}"><i class="fas fa-reply"></i></button>
			</div>
		</div>
		`;

	const renderReviewRow = (
		review: {
			id: string;
			username: string;
			thumbnail: string | null;
			rating: number;
			body: string | null;
			createdAt: string;
			replies: ReviewReply[];
		},
		creatorId: number | null,
		isOwn = false,
		isEditing = false,
		pendingRating = review.rating,
	) => {
		const date = renderTimestamp(review.createdAt);

		const editing = isOwn && isEditing;

		return `
			<div class="card mcard mb-2${isOwn ? " border border-primary" : ""}">
				<div class="card-body p-3">
					<div class="d-flex align-items-center gap-2 mb-2">
						<a href="/u/${review.username}" class="flex-shrink-0">
							<img src="${review.thumbnail}" alt="${review.username}" class="rounded-circle border border-2 border-secondary" width="40" height="40">
						</a>
						<div class="min-w-0 flex-grow-1">
							<a href="/u/${review.username}" class="text-reset"><span class="userlink-default fw-bold">${review.username}</span></a>
							<div class="text-muted small">
								<i class="fad fa-clock me-1"></i>${date}
							</div>
						</div>
						${
							isOwn
								? `<button class="btn btn-sm btn-outline-secondary kiln-review-edit flex-shrink-0 px-2 py-1" title="Edit your review"><i class="fas fa-pen"></i></button>
								<button class="btn btn-sm btn-outline-danger kiln-review-delete flex-shrink-0 px-2 py-1 ms-1" title="Delete your review"><i class="fas fa-trash"></i></button>`
								: ""
						}
					</div>
					${
						editing
							? `<textarea class="form-control form-control-sm bg-dark text-light border-secondary kiln-review-body mb-2" rows="2" placeholder="Optional comment..." style="resize:vertical;font-size:0.85rem;">${review.body ?? ""}</textarea>`
							: `<p class="mb-2 feed-post-text">${review.body ?? ""}</p>`
					}
					${
						editing
							? `<div class="d-flex gap-1 mb-2 kiln-star-picker">${renderStars(pendingRating, true)}</div>`
							: `<div class="mb-2">${renderStars(review.rating)}</div>`
					}
					${
						editing
							? `<div class="d-flex gap-2 mb-2">
								<button class="btn btn-primary btn-sm kiln-review-submit" ${pendingRating === 0 ? "disabled" : ""}>Update</button>
								<button class="btn btn-outline-secondary btn-sm kiln-review-cancel">Cancel</button>
							</div>`
							: ""
					}
					${renderRepliesSection(review, creatorId)}
				</div>
			</div>
			`;
	};

	const navItem = document.createElement("li");
	navItem.className = "nav-item";
	navItem.setAttribute("role", "presentation");
	navItem.innerHTML = `
		<a class="nav-link text-light" href="#!" id="reviews-tab" data-bs-toggle="tab" role="tab"
		   data-bs-target="#reviews-tabpane" aria-controls="reviews-tabpane" aria-selected="false" tabindex="-1">
			<i class="fas fa-star me-1"></i>
			Reviews
			<span class="kiln-review-avg-badge"></span>
		</a>
	`;
	tabList.appendChild(navItem);

	const tabPane = document.createElement("div");
	tabPane.id = "reviews-tabpane";
	tabPane.className = "tab-pane fade";
	tabPane.setAttribute("role", "tabpanel");
	tabPane.setAttribute("aria-labelledby", "reviews-tab");
	tabPane.innerHTML = `
		<div class="d-flex justify-content-center py-3">
			<div class="spinner-border spinner-border-sm text-secondary" role="status">
				<span class="visually-hidden">Loading...</span>
			</div>
		</div>
	`;
	tabContent.appendChild(tabPane);

	const cardBody = tabPane;
	const avgBadge = navItem.querySelector<HTMLElement>(
		".kiln-review-avg-badge",
	)!;
	avgBadge.innerHTML = `<span class="badge bg-secondary ms-1" style="font-size:0.8rem;">...</span>`;

	if (!isVerified) {
		avgBadge.innerHTML = "";
		cardBody.innerHTML = `
			<p class="text-muted small mb-2"><i class="fa-regular fa-lock me-1"></i> Verify your Kiln account to leave a review.</p>
			<a href="/my/settings/kiln?tab=sync" class="btn btn-primary btn-sm">Verify Account</a>`;
		return;
	}

	await loadReviews();

	async function loadReviews() {
		const results = await Promise.all([
			sendMessage("getPlaceReviews", { placeId: placeID, userId }),
			sendMessage("getGameActivity", {
				userId,
				gameId: placeID,
				page: 1,
				pageSize: 25,
			}),
			sendMessage("getPlace", placeID),
		]).catch((err) => {
			console.warn("[Kiln] Failed to load place reviews:", err);
			return null;
		});
		if (!results) {
			avgBadge.innerHTML = "";
			cardBody.innerHTML = `<div class="text-muted small fst-italic">Failed to load reviews.</div>`;
			return;
		}
		const [result, activityResult, placeResult] = results;
		if (!result.ok) {
			avgBadge.innerHTML = "";
			cardBody.innerHTML = `<div class="text-muted small fst-italic">Failed to load reviews.</div>`;
			return;
		}

		const totalPlaytimeMs = activityResult.ok
			? activityResult.data.totalPlaytime
			: null;
		const hasEnoughPlaytime =
			totalPlaytimeMs === null || totalPlaytimeMs >= MIN_REVIEW_PLAYTIME_MS;
		const creatorId = placeResult.ok ? placeResult.data.creator.id : null;
		const isCreator = creatorId !== null && creatorId === userId;

		const formatMinutes = (minutes: number) => {
			if (minutes < 60) return `${minutes}min${minutes === 1 ? "" : "s"}`;
			const h = Math.floor(minutes / 60);
			const m = minutes % 60;
			return m > 0 ? `${h}hrs ${m}mins` : `${h}hrs`;
		};

		let { reviews, averageRating, totalReviews, myReview } = result.data.data;
		let pendingRating = myReview?.rating ?? 0;
		let isSubmitting = false;
		let isEditing = false;

		const updateAvgBadge = () => {
			if (averageRating === null || totalReviews === 0) {
				avgBadge.innerHTML = "";
				return;
			}
			avgBadge.innerHTML = `<span class="badge bg-warning text-dark ms-1" style="font-size:0.8rem;"><i class="fas fa-star me-1"></i>${averageRating.toFixed(1)} <span class="fw-normal opacity-75">(${totalReviews})</span></span>`;
		};

		const render = () => {
			updateAvgBadge();

			const otherReviews = reviews.filter((r) => r.userId !== userId);

			const showEditor =
				isEditing || (!myReview && !isCreator && hasEnoughPlaytime);

			const formHTML = isCreator
				? `
			<div class="kiln-review-form border-bottom border-secondary pb-3 mb-3">
				<p class="text-muted mb-0">
					<i class="fa-regular fa-ban me-1"></i> You cannot review your own world.
				</p>
			</div>`
				: !hasEnoughPlaytime
					? `
			<div class="kiln-review-form border-bottom border-secondary pb-3 mb-3">
				<p class="text-muted mb-0">
					<i class="fa-regular fa-clock me-1"></i> You need at least 5 minutes of playtime in this world to leave a review${
						totalPlaytimeMs !== null
							? ` (you've played ${formatMinutes(Math.round(totalPlaytimeMs / 60_000))} so far)`
							: ""
					}.
				</p>
			</div>`
					: !myReview && showEditor
						? `
			<div class="kiln-review-form card mcard mb-2 border border-primary">
				<div class="card-body p-3">
					<div class="text-muted mb-2 fw-bold">Leave a Review</div>
					<textarea class="form-control form-control-sm bg-dark text-light border-secondary kiln-review-body mb-2" rows="2" placeholder="Optional comment..." style="resize:vertical;font-size:0.85rem;"></textarea>
					<div class="d-flex gap-1 mb-2 kiln-star-picker">
						${renderStars(pendingRating, true)}
					</div>
					<div class="d-flex gap-2">
						<button class="btn btn-primary btn-sm kiln-review-submit" ${pendingRating === 0 ? "disabled" : ""}>
							Submit
						</button>
					</div>
				</div>
			</div>
			<hr class="border-secondary m-2">`
						: "";

			const myReviewHTML = myReview
				? renderReviewRow(myReview, creatorId, true, isEditing, pendingRating)
				: "";

			const othersHTML =
				otherReviews.length === 0
					? myReview
						? ""
						: `<div class="text-muted fst-italic">No other reviews yet.</div>`
					: otherReviews.map((r) => renderReviewRow(r, creatorId)).join("");

			cardBody.innerHTML = formHTML + myReviewHTML + othersHTML;
			sendMessage("registerBootstrapElements");

			cardBody
				.querySelectorAll<HTMLButtonElement>(".kiln-reply-submit")
				.forEach((replySubmitBtn) => {
					replySubmitBtn.addEventListener("click", async () => {
						const reviewId = replySubmitBtn.dataset.reviewId!;
						const replyTextarea = cardBody.querySelector<HTMLTextAreaElement>(
							`.kiln-reply-textarea[data-review-id="${reviewId}"]`,
						)!;

						const replyBody = replyTextarea.value.trim();
						if (!replyBody) return;

						replySubmitBtn.disabled = true;
						const res = await sendMessage("submitReviewReply", {
							userId,
							reviewId,
							body: replyBody,
						});

						if (!res.ok) {
							replySubmitBtn.disabled = false;
							return;
						}

						const target =
							myReview?.id === reviewId
								? myReview
								: reviews.find((r) => r.id === reviewId);
						target?.replies.push(res.data.data);

						render();
					});
				});

			cardBody
				.querySelectorAll<HTMLButtonElement>(".kiln-reply-delete")
				.forEach((deleteReplyBtn) => {
					deleteReplyBtn.addEventListener("click", async () => {
						const replyId = deleteReplyBtn.dataset.replyId!;
						deleteReplyBtn.disabled = true;

						const res = await sendMessage("deleteReviewReply", {
							userId,
							replyId,
						});
						if (!res.ok) {
							deleteReplyBtn.disabled = false;
							return;
						}

						for (const r of myReview ? [myReview, ...reviews] : reviews) {
							const idx = r.replies.findIndex((reply) => reply.id === replyId);
							if (idx !== -1) {
								r.replies.splice(idx, 1);
								break;
							}
						}

						render();
					});
				});

			cardBody
				.querySelector<HTMLButtonElement>(".kiln-review-edit")
				?.addEventListener("click", () => {
					isEditing = true;
					pendingRating = myReview?.rating ?? 0;
					render();
				});

			cardBody
				.querySelector<HTMLButtonElement>(".kiln-review-cancel")
				?.addEventListener("click", () => {
					isEditing = false;
					pendingRating = myReview?.rating ?? 0;
					render();
				});

			const deleteBtn = cardBody.querySelector<HTMLButtonElement>(
				".kiln-review-delete",
			);

			deleteBtn?.addEventListener("click", async () => {
				if (isSubmitting) return;
				isSubmitting = true;
				deleteBtn.disabled = true;
				deleteBtn.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;

				const res = await sendMessage("deleteMyPlaceReview", {
					placeId: placeID,
					userId,
				});
				isSubmitting = false;
				if (!res.ok) {
					deleteBtn.disabled = false;
					deleteBtn.innerHTML = `<i class="fas fa-trash"></i>`;
					return;
				}

				reviews = reviews.filter((r) => r.userId !== userId);
				myReview = null;
				pendingRating = 0;
				isEditing = false;
				totalReviews = Math.max(0, totalReviews - 1);
				averageRating =
					reviews.length > 0
						? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
						: null;

				render();
			});

			if (!showEditor) return;

			const starPicker =
				cardBody.querySelector<HTMLElement>(".kiln-star-picker")!;
			const textarea =
				cardBody.querySelector<HTMLTextAreaElement>(".kiln-review-body")!;
			const submitBtn = cardBody.querySelector<HTMLButtonElement>(
				".kiln-review-submit",
			)!;

			starPicker.addEventListener("click", (e) => {
				const star = (e.target as HTMLElement).closest<HTMLElement>(
					".kiln-review-star",
				);
				if (!star || isSubmitting) return;
				pendingRating = parseInt(star.dataset.star ?? "0", 10);
				starPicker.innerHTML = renderStars(pendingRating, true);
				submitBtn.disabled = pendingRating === 0;

				starPicker
					.querySelectorAll<HTMLElement>(".kiln-review-star")
					.forEach((s) => {
						s.addEventListener("mouseenter", () => {
							const hov = parseInt(s.dataset.star ?? "0", 10);
							starPicker
								.querySelectorAll<HTMLElement>(".kiln-review-star")
								.forEach((st) => {
									const n = parseInt(st.dataset.star ?? "0", 10);
									st.className = `${n <= hov ? "fas" : "far"} fa-star kiln-review-star`;
									(st as HTMLElement).style.color =
										n <= hov ? "#f0b429" : "#aaa";
								});
						});
					});
				starPicker.addEventListener("mouseleave", () => {
					starPicker.innerHTML = renderStars(pendingRating, true);
					attachStarHover();
				});
			});

			const attachStarHover = () => {
				starPicker
					.querySelectorAll<HTMLElement>(".kiln-review-star")
					.forEach((s) => {
						s.addEventListener("mouseenter", () => {
							const hov = parseInt(s.dataset.star ?? "0", 10);
							starPicker
								.querySelectorAll<HTMLElement>(".kiln-review-star")
								.forEach((st) => {
									const n = parseInt(st.dataset.star ?? "0", 10);
									st.className = `${n <= hov ? "fas" : "far"} fa-star kiln-review-star`;
									(st as HTMLElement).style.color =
										n <= hov ? "#f0b429" : "#aaa";
								});
						});
					});
				starPicker.addEventListener("mouseleave", () => {
					starPicker.innerHTML = renderStars(pendingRating, true);
					attachStarHover();
				});
			};
			attachStarHover();

			submitBtn.addEventListener("click", async () => {
				if (isSubmitting || pendingRating === 0) return;
				isSubmitting = true;
				submitBtn.disabled = true;
				submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>${myReview ? "Updating..." : "Submitting..."}`;

				const body = textarea.value.trim() || undefined;
				const res = await sendMessage("submitPlaceReview", {
					placeId: placeID,
					userId,
					rating: pendingRating,
					body,
				});

				isSubmitting = false;
				if (!res.ok) {
					submitBtn.disabled = false;
					submitBtn.textContent = myReview ? "Update" : "Submit";
					return;
				}

				const submitted = res.data.data;
				if (myReview) {
					reviews = reviews.filter((r) => r.userId !== userId);
				}
				myReview = submitted;
				reviews = [submitted, ...reviews.filter((r) => r.userId !== userId)];

				const prevTotal = totalReviews;
				if (!myReview || prevTotal === 0) {
					totalReviews = prevTotal + 1;
				}
				averageRating =
					reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length ||
					null;

				isEditing = false;
				render();
			});
		};

		render();
	}
}

export async function autoRefreshData(interval: "30s" | "1m" | "5m") {
	const intervalMs = { "30s": 30_000, "1m": 60_000, "5m": 300_000 }[interval];
	const relativeTime = (iso: string | null): string => {
		if (!iso) return "Never";
		const diffMs = Date.now() - new Date(iso).getTime();
		const diffDays = Math.floor(diffMs / 86_400_000);
		if (diffDays === 0) return "Today";
		if (diffDays === 1) return "Yesterday";
		if (diffDays < 30) return `${diffDays} days ago`;
		const diffMonths = Math.floor(diffDays / 30);
		if (diffMonths < 12)
			return `${diffMonths} month${diffMonths > 1 ? "s" : ""} ago`;
		const diffYears = Math.floor(diffMonths / 12);
		return `${diffYears} year${diffYears > 1 ? "s" : ""} ago`;
	};

	const infoCard = document.querySelector(".card-body:has(.fa-calendar)");

	const updateLi = (iconClass: string, text: string) => {
		const li = infoCard?.querySelector<HTMLLIElement>(`li:has(.${iconClass})`);
		if (!li) return;
		const icon = li.querySelector("i")!;
		li.innerHTML = icon.outerHTML + text;
	};

	const flashLi = (iconClass: string, direction: "up" | "down") => {
		const li = infoCard?.querySelector<HTMLLIElement>(`li:has(.${iconClass})`);
		if (!li) return;
		li.style.transition = "";
		li.style.color = direction === "up" ? "#198754" : "#dc3545";
		requestAnimationFrame(() => {
			li.style.transition = "color 1.5s ease";
			li.style.color = "";
		});
	};

	let prevVisits: number | null = null;

	const refresh = async () => {
		const placeData = await sendMessage("getPlace", placeID);
		if (!placeData.ok) return;
		const place = placeData.data;

		updateLi("fa-users", place.visits.toLocaleString());
		updateLi("fa-clock", relativeTime(place.updatedAt));

		if (prevVisits !== null && place.visits !== prevVisits) {
			flashLi("fa-users", place.visits > prevVisits ? "up" : "down");
		}
		prevVisits = place.visits;
	};

	await refresh();
	setInterval(refresh, intervalMs);
}

export async function placeConsumablesTab(creatorId: string) {
	const tabList = document.getElementById("place-tabs");
	const tabContent = document.querySelector(".card-body.tab-content");
	if (!tabList || !tabContent) return;

	const navItem = document.createElement("li");
	navItem.className = "nav-item";
	navItem.setAttribute("role", "presentation");
	navItem.innerHTML = `
		<a class="nav-link text-light" href="#!" id="consumables-tab" data-bs-toggle="tab" role="tab"
		   data-bs-target="#consumables-tabpane" aria-controls="consumables-tabpane" aria-selected="false" tabindex="-1">
			<i class="fad fa-flask me-1"></i>
			Consumables
		</a>
	`;
	tabList.appendChild(navItem);

	const tabPane = document.createElement("div");
	tabPane.id = "consumables-tabpane";
	tabPane.className = "tab-pane fade";
	tabPane.setAttribute("role", "tabpanel");
	tabPane.setAttribute("aria-labelledby", "consumables-tab");
	tabPane.innerHTML = `
		<div class="d-flex justify-content-center py-3">
			<div class="spinner-border spinner-border-sm text-secondary" role="status">
				<span class="visually-hidden">Loading...</span>
			</div>
		</div>
	`;
	tabContent.appendChild(tabPane);

	let loaded = false;

	navItem.querySelector("a")!.addEventListener("click", async () => {
		if (loaded) return;
		loaded = true;

		const consumables: {
			id: number;
			name: string;
			description: string;
			thumbnail: string;
			price: number | null;
		}[] = [];

		let page = 1;
		while (page <= 10) {
			const result = await sendMessage("getUserCreations", {
				userId: +creatorId,
				page,
				limit: 100,
			});
			if (!result.ok) break;
			console.log(
				result.data.assets,
				...result.data.assets.filter((a) => a.type === "consumable"),
			);
			consumables.push(
				...result.data.assets.filter((a) => a.type === "consumable"),
			);
			if (result.data.pages <= page) break;
			page++;
		}

		if (consumables.length === 0) {
			tabPane.innerHTML = `
				<div class="text-center py-3 text-muted">
					<h1 class="display-3"><i class="fad fa-flask"></i></h1>
					<h6 class="mb-0">this world does not have any consumables yet!</h6>
				</div>
			`;
			return;
		}

		tabPane.innerHTML = consumables
			.map(
				(item) => `
				<div class="card card-highlight-transition mcard mb-2">
					<div class="card-body">
						<div class="row">
							<div class="col-auto ms-2 px-0 d-flex align-items-center">
								<div class="m-0 p-1" style="width:96px;justify-content:center">
									<a href="/store/${item.id}">
										<img src="${item.thumbnail}" class="img-fluid">
									</a>
								</div>
							</div>
							<div class="col-10 px-2">
								<a href="/store/${item.id}" class="text-reset">
									<h5 class="mb-0">${item.name}</h5>
								</a>
								<p class="my-0 text-truncate">${item.description}</p>
								<p class="text-muted small my-0">
									${item.price !== null ? `<i class="pi pi-brick me-1"></i>${item.price.toLocaleString()}` : "Free"}
								</p>
							</div>
						</div>
					</div>
				</div>`,
			)
			.join("");
	});
}

export function serverRefreshing(onRefresh?: (serverList: Element) => void) {
	const tabPane = document.getElementById("servers-tabpane")!;

	const serverList = document.createElement("div");
	serverList.className = "kiln-server-list";
	while (tabPane.firstChild) {
		serverList.appendChild(tabPane.firstChild);
	}

	const refreshBar = document.createElement("div");
	refreshBar.className = "d-flex justify-content-end mb-2";
	Object.assign(refreshBar.style, {
		position: "absolute",
		top: 0,
		margin: "8px",
		right: 0,
	});
	refreshBar.innerHTML = `
		<button class="btn btn-sm btn-outline-secondary kiln-servers-refresh-btn" type="button" title="Refresh servers">
			<i class="fas fa-sync-alt me-1"></i>Refresh
		</button>
	`;
	tabPane.append(refreshBar, serverList);

	const refreshBtn = refreshBar.querySelector<HTMLButtonElement>(
		".kiln-servers-refresh-btn",
	)!;

	refreshBtn.addEventListener("click", async () => {
		refreshBtn.disabled = true;
		refreshBtn.innerHTML = `<i class="fas fa-sync-alt fa-spin me-1"></i>Refresh`;

		try {
			const response = await fetch(window.location.href);
			const html = await response.text();
			const dom = new DOMParser().parseFromString(html, "text/html");

			const freshTabPane = dom.getElementById("servers-tabpane");
			if (!freshTabPane) return;

			serverList.innerHTML = freshTabPane.innerHTML;
			onRefresh?.(serverList);
			sendMessage("registerBootstrapElements");
		} finally {
			refreshBtn.disabled = false;
			refreshBtn.innerHTML = `<i class="fas fa-sync-alt me-1"></i>Refresh`;
		}
	});
}
