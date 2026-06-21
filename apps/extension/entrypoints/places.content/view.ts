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
import { getConfig, pullKVCache } from "@/utils/utilities";

const placeID = +window.location.pathname.split("/")[2];

/**
 * Displays a pin button on the place page backed by the Kiln extension API.
 */
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

/**
 * Displays the approximated amount of revenue generated from a certain place, based off the unique visits & any gamepass sales (taking into account the creator's current membership tax)
 */
export async function approxPlaceRevenue() {
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

	value.innerHTML = `<i class="pi pi-brick me-2"></i> ~${revenue.toLocaleString()}`;
}

/**
 * Adds a section where users can see any active challenges (if any) for the current place they are looking at
 */
export async function activeChallenges() {
	const getRawTooltip = (el: Element | null) =>
		el?.getAttribute("data-bs-original-title") ||
		el?.getAttribute("data-bs-title") ||
		el?.getAttribute("title") ||
		null;

	const escAttr = (s: string) =>
		s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

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
			(challenge) => challenge.place?.id === placeID,
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

/**
 * Tracks the user's playtime of the current place.
 * @param userId The ID of the authenticated user.
 */
export async function playtimeTracking(userId: number) {
	let port: ReturnType<typeof browser.runtime.connect> | null = null;
	let activeSessionId: string | null = null;

	const connectToSession = (sessionId: string) => {
		if (port) return;
		port = browser.runtime.connect({ name: "kiln-time-played" });
		port.postMessage({ userId, sessionId, placeId: placeID });
		port.onDisconnect.addListener(() => {
			port = null;
		});
	};

	const startSession = async () => {
		if (port) return;
		if (activeSessionId) {
			connectToSession(activeSessionId);
			return;
		}
		const result = await sendMessage("startTimePlayedSession", {
			userId,
			placeId: placeID,
		});
		if (!result.ok) return;
		activeSessionId = result.data.data.id;
		connectToSession(activeSessionId);
	};

	if (!(await getApiSession(userId))) {
		const infoColumn = document.querySelector(".card:has(.fa-calendar)")!
			.parentElement!;
		const card = document.createElement("div");
		card.classList.add("card", "mcard", "mt-2");
		card.innerHTML = `
			<div class="card-header">
				<i class="fas fa-clock me-1"></i> Your Playtime
			</div>
			<div class="card-body">
				<p class="text-muted small mb-2"><i class="fa-regular fa-lock me-1"></i> Verify your Kiln account to track playtime.</p>
				<a href="/my/settings/kiln?tab=sync" class="btn btn-primary btn-sm">Verify Account</a>
			</div>
		`;
		infoColumn.appendChild(card);
		return;
	}

	document.getElementById("btn-play")!.addEventListener("click", startSession);

	for (const btn of document.querySelectorAll('button[onclick^="joinPlace"]')) {
		btn.addEventListener("click", startSession);
	}

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

	type Session = {
		id: string;
		startedAt: string;
		endedAt: string | null;
		verifiedMinutes: number;
		unverifiedMinutes: number;
	};

	const sessions: Session[] = [];
	let page = 1;

	while (page <= 5) {
		const result = await sendMessage("getTimePlayedSessions", {
			userId,
			page,
			placeId: placeID,
		});
		if (!result.ok) break;
		sessions.push(...result.data.data);
		if (result.data.meta.currentPage >= result.data.meta.totalPages) break;
		page++;
	}

	activeSessionId = sessions.find((s) => s.endedAt === null)?.id ?? null;
	if (activeSessionId) connectToSession(activeSessionId);

	const totalVerified = sessions.reduce((sum, s) => sum + s.verifiedMinutes, 0);
	const totalUnverified = sessions.reduce(
		(sum, s) => sum + s.unverifiedMinutes,
		0,
	);
	const total = totalVerified + totalUnverified;
	const avgMinutes =
		sessions.length > 0 ? Math.round(total / sessions.length) : 0;

	const rowsHTML =
		sessions.length === 0
			? `<div class="text-muted small fst-italic">No sessions recorded for this world yet.</div>`
			: sessions
					.map(
						(session) => `
					<div class="d-flex justify-content-between align-items-center py-1 border-bottom border-secondary" style="font-size:0.85rem;">
						<span class="text-muted">${formatDate(session.startedAt)}${session.endedAt === null ? ' <span class="badge bg-success ms-1" style="font-size:0.7rem;">Live</span>' : ""}</span>
						<span>${formatMinutes(session.verifiedMinutes + session.unverifiedMinutes)}</span>
					</div>`,
					)
					.join("");

	const card = document.createElement("div");
	card.classList.add("card", "mcard", "mt-2");
	card.innerHTML = `
		<div class="card-header d-flex align-items-center">
			<div class="flex-grow-1">
				<i class="fas fa-clock me-1"></i> Your Playtime
			</div>
			<span class="badge bg-primary ms-1">${total > 0 ? formatMinutes(total) : "0m"} total</span>
		</div>
		<div class="card-body" style="max-height:300px; overflow-y:auto;">
			${
				sessions.length > 0
					? `<div class="small text-muted mb-2">
						<i class="fas fa-shield-check text-success me-1"></i>${formatMinutes(totalVerified)} verified
						· <i class="fas fa-hourglass-half text-warning me-1"></i>${formatMinutes(totalUnverified)} unverified
						· <i class="fas fa-chart-bar me-1"></i>avg ${formatMinutes(avgMinutes)}/session
					</div>`
					: ""
			}
			${rowsHTML}
		</div>
	`;

	const infoColumn = document.querySelector(".card:has(.fa-calendar)")!
		.parentElement!;
	infoColumn.appendChild(card);

	sendMessage("registerBootstrapElements");
}

/**
 * Adds a progress bar to the achievements tab to show the percentage of all achievements for that place you've earned.
 */
export function achievementsProgressBar() {
	const tabContents = document.getElementById("achievements-tabpane")!;
	const earned = tabContents.querySelectorAll(".fad.fa-check-circle").length;

	const percentage = (earned * 100) / tabContents.children.length;
	const percentageDisplay = (
		(earned * 100) /
		tabContents.children.length
	).toFixed(0);

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

/**
 * Makes achievements, listed under the achievements tab of a place, that aren't earned yet slightly transparent.
 */
export function fadedUnearnedAchievements() {
	const tab = document.getElementById("achievements-tabpane")!;

	for (const achievement of tab.getElementsByClassName("card")) {
		if (!achievement.querySelector(".fad.fa-check-circle")) {
			(achievement as HTMLElement).style.opacity = "0.5";
		}
	}
}

/**
 * Adds a percentage and difficulty rating to achievements listed under the achievements tab of a place based on how many of the unique players that visited the place have earned each achievement.
 */
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

/**
 * Adds a button to each server under the servers tab of a place that copies a link with the server ID in the URL.
 */
export function serverShareLinks() {
	const tab = document.getElementById("servers-tabpane")!;

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

/**
 * Adds a label identifying comments made by the creator of the place.
 */
export function creatorCommentLabels() {
	const creatorId = (
		document.querySelector(
			'.place-hero-content a:has([class^="userlink-"])',
		)! as HTMLLinkElement
	)
		.getAttribute("href")!
		.split("/")[2];

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

	rightCol.insertAdjacentHTML(
		"beforeend",
		`<div class="row px-3 px-lg-2">
      <div class="col px-1">
        <button class="btn btn-lg btn-game w-100 my-2" id="btn-play" onclick="joinPlace()">
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
      <div class="col-auto px-1">
        <a href="/create/place/${placeID}" class="btn btn-lg btn-secondary px-4 my-2" style="padding:9px 14px; min-width:110px;" data-bs-toggle="tooltip" data-bs-placement="top" aria-label="World settings" data-bs-original-title="World settings">
          <i class="fas fa-gear"></i>
        </a>
      </div>`
					: ""
			}
    </div>`,
	);

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