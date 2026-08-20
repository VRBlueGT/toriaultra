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

import type { Extension, PolyTrack, Polytoria } from "@kiln/schemas";
import { _savedThemes, _userNotes, preferences } from "@/utils/storage";
import { applyKilnTheme, THEME_PRESETS } from "@/utils/theme";
import {
	applyKilnDisclosureTitle,
	kilnDisclosureBadgeHtml,
} from "@/utils/utilities";

export async function pinnedAchievements(
	userId: number,
	showDisclosures: boolean,
) {
	const result = await sendMessage("getPinnedAchievements", userId);
	if (!result.ok || result.data.data.length === 0) return;

	const items = (
		await Promise.all(
			result.data.data.map(async (id) => {
				const r = await sendMessage("getItem", id);
				return r.ok ? r.data : null;
			}),
		)
	).filter(Boolean) as Polytoria.ItemApi[];

	if (items.length === 0) return;

	const existingTitle = document.querySelector<HTMLElement>(".section-title");
	const usernameMatch = existingTitle?.textContent?.trim().match(/^(.+?)'s\s/);
	const displayName = usernameMatch?.[1] ?? "";

	const section = document.createElement("div");
	section.innerHTML = `
		<h6 class="section-title px-3 px-lg-0 mt-3">
			<i class="fas fa-trophy me-1"></i>
		</h6>
		<div class="card mcard card-themed mt-2">
			<div class="card-body pb-1">
				<div class="row"></div>
			</div>
		</div>
	`;

	const titleEl = section.querySelector("h6")!;
	titleEl.append(
		document.createTextNode(
			displayName
				? `${displayName}'s Pinned Achievements`
				: "Pinned Achievements",
		),
	);
	titleEl.insertAdjacentHTML(
		"beforeend",
		kilnDisclosureBadgeHtml(showDisclosures),
	);

	const grid = section.querySelector<HTMLDivElement>(".row")!;
	for (const item of items) {
		const col = document.createElement("div");
		col.classList.add("col-6", "col-md-2", "mb-3");
		col.innerHTML = `
			<a href="/store/${item.id}" class="text-reset">
				<img src="" class="img-fluid rounded" alt="">
				<h6 class="text-truncate mb-0 mt-3"></h6>
			</a>
		`;
		col.querySelector("img")!.src = item.thumbnail;
		col.querySelector("img")!.alt = item.name;
		col.querySelector("h6")!.textContent = item.name;
		grid.appendChild(col);
	}

	const imagesCard = document.getElementById("user-about-bio-card");
	if (imagesCard) {
		imagesCard.insertAdjacentElement("afterend", section);
	} else {
		document.getElementsByClassName("user-right")[0]?.prepend(section);
	}
}

export async function userLabels(
	userId: number,
	inactiveDays: number,
	ogYear: number,
	showDisclosures: boolean,
) {
	const card = document.getElementById("user-stats-card");
	if (!card) return;

	const result = await sendMessage("checkUserActivity", {
		userIds: [userId],
		days: inactiveDays,
	});
	if (!result.ok) return;

	const info = result.data[String(userId)];
	if (!info) return;

	const OG_CUTOFF = `${ogYear + 1}-01-01`;
	const isInactive = !info.active;
	const isOG = !!(
		info.registeredAt && info.registeredAt.slice(0, 10) < OG_CUTOFF
	);

	if (!isInactive && !isOG) return;

	const cardBody = card.children[0];
	if (isInactive)
		cardBody.insertAdjacentHTML(
			"beforeend",
			`<span class="badge bg-secondary ms-1" data-bs-toggle="tooltip" data-bs-title="Hasn't been seen online in the last ${inactiveDays} days">Inactive</span>${kilnDisclosureBadgeHtml(showDisclosures)}`,
		);
	if (isOG)
		cardBody.insertAdjacentHTML(
			"beforeend",
			`<span class="badge bg-warning text-dark ms-1" data-bs-toggle="tooltip" data-bs-title="Joined during ${ogYear} or earlier">OG</span>${kilnDisclosureBadgeHtml(showDisclosures)}`,
		);

	sendMessage("registerBootstrapElements");
}

export async function displayId(
	userId: number,
	blocked: boolean = false,
	showDisclosures: boolean = false,
) {
	const card = !blocked
		? document.getElementById("user-stats-card")
		: document.querySelector(".card-body:has(.fa-ban)");
	if (!card) return;

	const row = document.createElement("div");
	row.classList.add("mb-1");
	row.innerHTML = `
    <b>
        <i class="fa fa-hashtag text-center d-inline-block" style="width:1.3em"></i>
        Player ID${kilnDisclosureBadgeHtml(showDisclosures)}
    </b>
    <span class="float-end">
        ${userId}
        <a href="#">
            <i class="fad fa-copy" style="margin-left: 5px;"></i>
        </a>
    </span>
    `;

	const copyBtn = row.getElementsByTagName("a")[0];
	copyBtn.addEventListener("click", (e) => {
		e.preventDefault();

		navigator.clipboard
			.writeText(String(userId))
			.then(() => {
				const icon: HTMLElement = copyBtn.children[0] as HTMLElement;
				copyBtn.classList.add("text-success");
				icon.setAttribute("class", "fa-duotone fa-circle-check");
				icon.style.marginLeft = "3px";

				setTimeout(() => {
					copyBtn.classList.remove("text-success");
					icon.setAttribute("class", "fad fa-copy");
					icon.style.marginLeft = "5px";
				}, 1500);
			})
			.catch(() => {
				alert("Failure to copy user ID to clipboard.");
			});
	});

	if (!blocked) {
		card.children[0].insertBefore(
			row,
			card.querySelector(".mb-1:has(.fa-calendar)")!,
		);
	} else {
		card.appendChild(row);
	}
}

export async function outfitCost(
	userId: number,
	includeIRLRevenue: boolean,
	irlCurrency: CurrencyCode,
	showDisclosures: boolean,
) {
	const calculateBtn = document.createElement("small");
	calculateBtn.classList.add("fw-normal");
	calculateBtn.style.letterSpacing = "0px";
	applyKilnDisclosureTitle(
		calculateBtn,
		showDisclosures,
		"Avatar cost calculator",
	);

	const calculate = async () => {
		const outfit = {
			cost: 0,
			collectibles: 0,
			offsale: 0,
			timed: 0,
		};

		// TODO: Look into making a cache function that can check to see if the current state on the page is identical to what the cached version is, to reduce on wasted requests
		const avatarResult = await sendMessage("getUserAvatar", userId);
		if (!avatarResult.ok) {
			calculateBtn.innerHTML =
				'<span class="text-secondary">Outfit cost unavailable, please try again later</span>';
			throw new Error(
				"[Kiln] API is disabled, cancelling avatar cost loading..",
			);
		}
		const avatar = avatarResult.data;

		if (avatar.isDefault) {
			calculateBtn.innerHTML =
				'<span class="text-secondary">Default character</span>';
			console.warn(
				"[Kiln] User has default avatar, cancelling avatar cost loading..",
			);
			return;
		}

		for (const asset of avatar.assets.filter(
			(asset) => asset.type != "profileTheme",
		)) {
			const itemResult = await sendMessage("getItem", asset.id);
			if (!itemResult.ok) continue;
			const item: Polytoria.ItemApi = itemResult.data;

			if (item.isLimited) {
				outfit.collectibles++;
				outfit.cost += item.averagePrice!;
			} else if (!item.price) {
				outfit.offsale++;
			} else if (item.onSaleUntil != null) {
				outfit.timed++;
			} else {
				outfit.cost += item.price!;
			}
		}

		// TODO: Look into why some items are being counted as offsale instead of timed, for now just temporarily group them together
		outfit.offsale += outfit.timed;
		outfit.timed = 0;

		calculateBtn.innerHTML = `<span class="text-success"><i class="pi pi-brick me-2"></i> ${outfit.collectibles > 0 ? "approx. " : ""}${outfit.cost.toLocaleString()} brick(s) ${includeIRLRevenue && outfit.cost > 0 ? `<span class="text-muted">OR ${await bricksToCurrency(outfit.cost, irlCurrency)}</span>` : ""}</span> <i class="fa-solid fa-circle-info" data-bs-toggle="tooltip" data-bs-title="${[outfit.collectibles ? `${outfit.collectibles} collectibles` : "", outfit.offsale ? `${outfit.offsale} offsale items` : ""].filter(Boolean).join(", ")}; profile themes excluded"></i>`;
		sendMessage("registerBootstrapElements");
	};

	const config = await getConfig();
	if (config.apiAvailability.public) {
		calculateBtn.innerHTML =
			'<a class="text-decoration-underline text-success" style="text-decoration-color: rgb(15, 132, 79) !important;">$ calculate avatar cost</a>';
		calculateBtn.children[0].addEventListener("click", calculate);
	} else {
		calculateBtn.innerHTML =
			'<span class="text-secondary">Outfit cost unavailable, please try again later</span>';
		console.error(
			"[Kiln] API is disabled, outfit cost calculation is unavailable.",
		);
	}
	document
		.querySelector(".section-title:first-child")!
		.appendChild(calculateBtn);
}

// TODO: Make this just replace Historical Records section
export async function greatDivideStats(
	userId: number,
	showDisclosures: boolean,
) {
	const section = document.createElement("div");
	section.innerHTML = `
	<div class="d-grid mt-2 mb-4"></div>
	<h6 class="text-center section-title px-3 px-lg-0 fw-bold" style="background-clip:text;-webkit-background-clip:text;color:transparent;background-image: linear-gradient(90deg, #1ad05b, #68f);-webkit-text-fill-color: transparent;">
		<i class="fas fa-swords me-1 float-start"></i>
		THE DIVIDE
		<i class="fas fa-swords me-1 float-end"></i>
	</h6>
	<div class="card mcard mb-4" style="min-height: 226px; background-image: linear-gradient(rgba(0.7, 0.7, 0.7, 0.7), rgba(0.7, 0.7, 0.7, 0.7)), url('https://blog.polytoria.com/content/images/2024/06/TheGreatDivide.png'); background-size: cover; background-position: center; border-color: #000 !important;">
		<div class="card-body">
			<button class="btn btn-primary btn-sm w-100">Load Statistics</button>
		</div>
	</div>
	`;
	applyKilnDisclosureTitle(
		section.querySelector("h6")!,
		showDisclosures,
		"THE DIVIDE",
	);

	const card = section.getElementsByClassName("card")[0]! as HTMLDivElement;
	const cardBody = card.children[0] as HTMLDivElement;
	cardBody.innerHTML = `
	<small class="d-block text-center text-muted" style="font-size: 0.8rem;">
		Loading...
	</small>
	<lottie-player id="avatar-loading" src="https://cdn.polytoria.com/static/images/lottie/poly-brick-loading.2b51aa85.json" background="transparent" speed="1" style="width: 20%;height: auto;margin: -16px auto 50px;margin-top: 0px;" loop="" autoplay=""></lottie-player>
	`;

	const statsResult = await sendMessage("getGreatDivideStats", userId);
	const stats = statsResult.ok
		? (statsResult.data as Extension.GreatDivideStatsApi)
		: null;

	if (!stats || "error" in stats) {
		card.classList.add("text-center", "py-5");
		card.innerHTML = `
		<h1 class="display-3"><i class="fa-solid fa-face-thinking"></i></h1>
		<h5> Not Drafted </h5>
		<p class="mb-0">This user didn't participate in The Great Divide.</p>
		`;

		throw new Error(
			"[Kiln] Could not retrieve user's Great Divide event statistics..",
		);
	}

	const kdrRaw = stats.kills / stats.deaths;
	const KDR = Number.isNaN(kdrRaw) ? "N/A" : kdrRaw.toFixed(2);
	const kdrClass =
		!Number.isNaN(kdrRaw) && kdrRaw > 1
			? "text-success"
			: !Number.isNaN(kdrRaw) && kdrRaw !== 0
				? "text-danger"
				: "";

	if (stats.team === "phantoms") {
		card.style.backgroundImage =
			'linear-gradient(rgba(0.7, 0.7, 0.7, 0.7), rgba(0.7, 0.7, 0.7, 0.7)), url("https://cdn.polytoria.com/assets/N3DH4x5a6iW7raaQ-3lwHpRHHpWShdXc.png")';
		card.style.border = "1.25px solid blue !important";
	} else {
		card.style.backgroundImage =
			'linear-gradient(rgba(0.7, 0.7, 0.7, 0.7), rgba(0.7, 0.7, 0.7, 0.7)), url("https://cdn.polytoria.com/assets/1HXpaoDLHJo2rrvwwxqJEDWvDZ6BgvSE.png")';
		card.style.border = "1.25px solid green !important";
	}

	const textClass = stats.team == "phantoms" ? "text-primary" : "text-success";

	cardBody.innerHTML = `
	<div class="mb-1">
		<b class="${textClass}">
			<i class="fa-duotone fa-eye text-center d-inline-block" style="width:1.2em"></i>
			Last Round Seen
		</b>
		<span class="float-end">
			#${stats.lastRoundSeen.toLocaleString()} / 2,578
		</span>
	</div>
	<hr class="mb-3 mt-2">
	<div class="mb-1">
		<b class="${textClass}">
			<i class="fa-duotone fa-swords text-center d-inline-block" style="width:1.2em"></i>
			Kills
		</b>
		<span class="float-end">
			${stats.kills.toLocaleString()}
		</span>
	</div>
	<div class="mb-1">
		<b class="${textClass}">
			<i class="fa-duotone fa-skull text-center d-inline-block" style="width:1.2em"></i>
			Deaths
		</b>
		<span class="float-end">
			${stats.deaths.toLocaleString()}
		</span>
	</div>
	<div class="mb-1">
		<b class="${textClass}">
			<i class="fa-solid fa-percent text-center d-inline-block" style="width:1.2em"></i>
			Kill Death Ratio
		</b>
		<span class="float-end ${kdrClass}">
			${KDR} <i class="fa-solid fa-circle-info" data-bs-toggle="tooltip" data-bs-title="KDR is a user's kills divided by the amount of times they have died. If their KDR is above 1, they are making a positive contribution. If their KDR is less than 1, that means they die more than they kill."></i>
		</span>
	</div>
	<div class="mb-1">
		<b class="${textClass}">
			<i class="fa-duotone fa-hundred-points text-center d-inline-block" style="width:1.2em"></i>
			Points Scored
		</b>
		<span class="float-end">
			${stats.pointsScored.toLocaleString()}
		</span>
	</div>
	<div class="mb-1">
		<b class="${textClass}">
			<i class="fa-solid fa-money-bill-wave text-center d-inline-block" style="width:1.2em"></i>
			Cash Earned
		</b>
		<span class="float-end">
			${stats.cashEarned.toLocaleString()}
		</span>
	</div>
	<div class="mb-1">
		<b class="${textClass}">
			<i class="fa-duotone fa-flag text-center d-inline-block" style="width:1.2em"></i>
			Flags Captured
		</b>
		<span class="float-end">
			${stats.flagsCaptured.toLocaleString()} (${stats.flagsReturned.toLocaleString()} returned)
		</span>
	</div>
	<div>
		<b class="${textClass}">
			<i class="fa-solid fa-box-open text-center d-inline-block" style="width:1.2em"></i>
			Airdrops Collected
		</b>
		<span class="float-end">
			${stats.airdropsCollected.toLocaleString()}
		</span>
	</div>
	<hr class="mb-3 mt-2">
	<div class="mb-1">
		<b class="${textClass}">
			<i class="fa-solid fa-chart-pyramid text-center d-inline-block" style="width:1.2em"></i>
			Monoliths Destroyed
		</b>
		<span class="float-end">
			${stats.obelisksDestroyed.toLocaleString()}
		</span>
	</div>
	<div class="mb-1">
		<b class="${textClass}">
			<i class="fa-duotone fa-block-question text-center d-inline-block" style="width:1.2em"></i>
			Blocks Placed
		</b>
		<span class="float-end">
			${stats.blocksPlaced.toLocaleString()} (${stats.blocksDestroyed.toLocaleString()} destroyed)
		</span>
	</div>
	<div class="mb-1">
		<b class="${textClass}">
			<i class="fa-duotone fa-head-side-brain text-center d-inline-block" style="width:1.2em"></i>
			Headshots
		</b>
		<span class="float-end">
			${stats.headshots.toLocaleString()}
		</span>
	</div>
	`;

	document.getElementsByClassName("user-right")[0].appendChild(section);
	sendMessage("registerBootstrapElements");
}

export async function basicBlockedInfo(
	userId: number,
	showDisclosures: boolean,
) {
	const formatDate = (dateStr: string) => {
		const d = new Date(dateStr);
		return `${
			[
				"January",
				"February",
				"March",
				"April",
				"May",
				"June",
				"July",
				"August",
				"September",
				"October",
				"November",
				"December",
			][d.getMonth()]
		} ${d.getDate()}, ${d.getFullYear()}`;
	};

	const card = document.querySelector(".card-body:has(.fa-ban)")!;
	const userResult = await sendMessage("getUser", userId);
	if (!userResult.ok) return;
	const { registeredAt } = userResult.data;

	const creationDateRow = document.createElement("div");
	creationDateRow.classList.add("mb-1", "text-start");
	creationDateRow.innerHTML = `
	<b><i class="fad fa-calendar text-center d-inline-block" style="width:1.2em"></i> Join date${kilnDisclosureBadgeHtml(showDisclosures)}</b>
	<span class="float-end">
		${formatDate(registeredAt)}
	</span>
	`;

	card.appendChild(creationDateRow);
}

export async function avatarVersions(userId: number, showDisclosures: boolean) {
	const profileVersions = await sendMessage("getProfileVersions", userId);
	if (!profileVersions.ok) return;

	const seen = new Set<string>();
	const avatars = profileVersions.data.profileStates.filter((state) => {
		if (
			state.avatarUrl == "https://images.polytrack.top/Broken.webp" ||
			new URL(state.avatarUrl).host == "cdn.polytoria.com" ||
			seen.has(state.avatarUrl)
		)
			return false;
		seen.add(state.avatarUrl);
		return true;
	});

	const dropdown = document.createElement("div");
	dropdown.classList.add("dropdown");

	const toggle = document.createElement("button");
	toggle.type = "button";
	toggle.classList.add("btn", "btn-primary", "btn-sm", "dropdown-toggle");
	toggle.setAttribute("data-bs-toggle", "dropdown");
	toggle.setAttribute("aria-expanded", "false");
	Object.assign(toggle.style, {
		position: "absolute",
		top: "-37px",
		width: "80%",
	});
	toggle.textContent = "Avatar Versions";
	applyKilnDisclosureTitle(toggle, showDisclosures, "Avatar Versions");

	const menu = document.createElement("ul");
	menu.classList.add("dropdown-menu");
	Object.assign(menu.style, {
		maxHeight: "250px",
		overflowY: "auto",
	});

	const render = document.getElementById("avatar2dImg")! as HTMLImageElement;
	const originalSrc = render.src;

	const currentLi = document.createElement("li");
	const currentBtn = document.createElement("button");
	currentBtn.type = "button";
	currentBtn.classList.add("dropdown-item");
	currentBtn.innerHTML = `<span class="badge bg-secondary">current</span> Current`;
	currentBtn.addEventListener("click", () => {
		if (render.style.display == "none") {
			document.getElementById("avatarToggleBtn")!.click();
		}
		render.src = originalSrc;
	});
	currentLi.appendChild(currentBtn);
	menu.appendChild(currentLi);

	for (const avatar of avatars) {
		const date = new Date(avatar.createdAt);

		const li = document.createElement("li");

		const btn = document.createElement("button");
		btn.type = "button";
		btn.classList.add("dropdown-item");
		btn.textContent = date.toLocaleString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
			hour: "numeric",
			minute: "2-digit",
		});
		btn.addEventListener("click", () => {
			if (render.style.display == "none") {
				document.getElementById("avatarToggleBtn")!.click();
			}
			render.src = avatar.avatarUrl;
		});

		if (date < new Date("2026-02-13")) {
			btn.innerHTML = `<span class="badge bg-danger">v1</span> ${btn.innerHTML}`;
		} else if (date < new Date("2026-03-09")) {
			btn.innerHTML = `<span class="badge bg-warning">v1.5</span> ${btn.innerHTML}`;
		} else {
			btn.innerHTML = `<span class="badge bg-primary">v2</span> ${btn.innerHTML}`;
		}

		li.appendChild(btn);
		menu.appendChild(li);
	}

	dropdown.appendChild(toggle);
	dropdown.appendChild(menu);

	render.parentElement!.appendChild(dropdown);

	sendMessage("registerBootstrapElements");
}

const CREATION_TYPE_META: Record<string, { icon: string; label: string }> = {
	model: { icon: "fad fa-cubes", label: "Models" },
	audio: { icon: "fad fa-volume-up", label: "Audio" },
	decal: { icon: "fad fa-image", label: "Images" },
	mesh: { icon: "fad fa-cube", label: "Meshes" },
	hat: { icon: "fas fa-hat-cowboy", label: "Hats" },
	tool: { icon: "fas fa-wrench", label: "Tools" },
	face: { icon: "fas fa-smile", label: "Faces" },
	clothing: { icon: "fas fa-tshirt", label: "Clothing" },
	gamePass: { icon: "fas fa-certificate", label: "Game Passes" },
	achievement: { icon: "fas fa-medal", label: "Achievements" },
	body: { icon: "fas fa-person-limbs-wide", label: "Bodies" },
	profileTheme: { icon: "fas fa-brush", label: "Profile Themes" },
	consumable: { icon: "fas fa-flask", label: "Consumables" },
};

function creationTypeLabel(type: string) {
	return (
		CREATION_TYPE_META[type]?.label ??
		type
			.replace(/([a-z])([A-Z])/g, "$1 $2")
			.replace(/^\w/, (c) => c.toUpperCase())
	);
}

function creationTypeIcon(type: string) {
	return CREATION_TYPE_META[type]?.icon ?? "fas fa-cube";
}

const CREATIONS_QUERY_PARAM = "kiln-creations";

function getProfileContainer(): HTMLElement | null {
	const anchor = document.getElementsByClassName("user-right")[0];
	return anchor?.closest<HTMLElement>(".container") ?? null;
}

function getProfileUsername(): string {
	const el = document.querySelector<HTMLElement>(
		'.text-themeglow [class^="userlink-"]',
	);
	return el?.innerText.trim() ?? "";
}

function getProfileThemeStyle(): HTMLStyleElement | null {
	let wrapper = document.querySelector<HTMLElement>(
		'div[style*="min-height: 60vh"]',
	);
	if (!wrapper) {
		wrapper =
			Array.from(document.getElementsByTagName("div")).find(
				(div) => div.style.minHeight === "60vh",
			) ?? null;
	}
	return wrapper?.querySelector("style") ?? null;
}

function getStickyNavbar(): HTMLElement | null {
	return document.querySelector<HTMLElement>(
		".navbar.navbar-expand-lg.navbar-light.bg-navbar.nav-topbar",
	);
}

function disableNavbarBlur(navbar: HTMLElement) {
	const state = {
		backgroundColor: navbar.style.backgroundColor,
		backdropFilter: navbar.style.backdropFilter,
		webkitBackdropFilter: navbar.style.getPropertyValue(
			"-webkit-backdrop-filter",
		),
	};

	navbar.style.backgroundColor = "";
	navbar.style.backdropFilter = "";
	navbar.style.removeProperty("-webkit-backdrop-filter");

	return () => {
		navbar.style.backgroundColor = state.backgroundColor;
		navbar.style.backdropFilter = state.backdropFilter;
		if (state.webkitBackdropFilter) {
			navbar.style.setProperty(
				"-webkit-backdrop-filter",
				state.webkitBackdropFilter,
			);
		}
	};
}

async function enableKilnTheme(): Promise<boolean> {
	const alreadyActive = !!document.getElementById("kiln-custom-theme");

	const values = await preferences.getPreferences();
	if (!values.enabled.includes("themeCreator")) return alreadyActive;

	const activeId = values.config.themeCreator.activeThemeId || "default";
	if (activeId === "default") return alreadyActive;

	if (activeId in THEME_PRESETS) {
		applyKilnTheme(THEME_PRESETS[activeId]);
	} else {
		const saved = await _savedThemes.getValue();
		const theme = saved.find((t) => t.id === activeId);
		applyKilnTheme(theme ?? null);
	}

	return alreadyActive;
}

async function showCreationsPage(userId: number) {
	const ITEMS_PER_PAGE = 28;

	const container = getProfileContainer();
	if (!container || container.querySelector(".kiln-creations-page")) return;

	const originalTitle = document.title;
	const basePath = window.location.pathname;
	const username = getProfileUsername();

	const existingChildren = Array.from(container.children) as HTMLElement[];
	for (const child of existingChildren) child.style.display = "none";

	const profileThemeStyle = getProfileThemeStyle();
	if (profileThemeStyle) profileThemeStyle.disabled = true;
	const hadKilnTheme = await enableKilnTheme();

	const navbar = getStickyNavbar();
	const restoreNavbarBlur = navbar ? disableNavbarBlur(navbar) : null;

	const kilnBadge = document.createElement("span");
	kilnBadge.classList.add("badge", "bg-warning", "mb-2");
	kilnBadge.textContent = "Kiln";
	container.prepend(kilnBadge);

	const page = document.createElement("div");
	page.className = "kiln-creations-page px-3 px-lg-0";
	page.innerHTML = `
		<nav aria-label="breadcrumb">
			<ol class="breadcrumb">
				<li class="breadcrumb-item"><a class="text-muted" href="/users">People</a></li>
				<li class="breadcrumb-item"><a class="text-muted" data-kiln="back-link"></a></li>
				<li class="breadcrumb-item active" aria-current="page"><span class="text-light">Creations</span></li>
			</ol>
		</nav>
		<div class="d-flex align-items-center justify-content-between">
			<h4 class="mb-0"></h4>
			<button type="button" class="btn btn-sm btn-outline-secondary" data-kiln="creations-back">
				<i class="fas fa-arrow-left me-1"></i>Back to Profile
			</button>
		</div>
	`;
	const backLink = page.querySelector<HTMLAnchorElement>(
		'[data-kiln="back-link"]',
	)!;
	backLink.href = basePath;
	backLink.textContent = username || "Profile";
	page.querySelector("h4")!.textContent = username
		? `${username}'s creations`
		: "Creations";
	kilnBadge.insertAdjacentElement("afterend", page);

	const hr = document.createElement("hr");
	hr.classList.add("mb-4");
	page.insertAdjacentElement("afterend", hr);

	const row = document.createElement("div");
	row.className = "row";
	row.innerHTML = `<div class="col-12 text-center py-4"><i class="fas fa-spinner fa-spin"></i></div>`;
	hr.insertAdjacentElement("afterend", row);

	const restore = () => {
		window.history.pushState(null, "", basePath);
		document.title = originalTitle;
		kilnBadge.remove();
		page.remove();
		hr.remove();
		row.remove();
		for (const child of existingChildren) child.style.display = "";
		if (profileThemeStyle) profileThemeStyle.disabled = false;
		if (!hadKilnTheme) applyKilnTheme(null);
		restoreNavbarBlur?.();
		activeAudio.current?.pause();
	};

	backLink.addEventListener("click", (e) => {
		e.preventDefault();
		restore();
	});
	page
		.querySelector<HTMLButtonElement>('[data-kiln="creations-back"]')!
		.addEventListener("click", restore);

	document.title = username ? `${username}'s Creations` : "Creations";

	let activeType = "all";
	let searchQuery = "";
	let currentPage = 1;
	let searchDebounce: ReturnType<typeof setTimeout>;
	const activeAudio: { current: HTMLAudioElement | null } = { current: null };

	const first = await sendMessage("getUserCreations", {
		userId,
		page: 1,
		limit: 100,
	});
	if (!first.ok) {
		row.innerHTML = `<p class="text-muted text-center py-3">Failed to load creations.</p>`;
		return;
	}

	const assets = [...first.data.assets];
	const rest = await Promise.all(
		Array.from({ length: first.data.pages - 1 }, (_, i) =>
			sendMessage("getUserCreations", { userId, page: i + 2, limit: 100 }),
		),
	);
	for (const result of rest) {
		if (result.ok) assets.push(...result.data.assets);
	}

	if (assets.length === 0) {
		row.innerHTML = `<p class="text-muted text-center py-3">No creations found.</p>`;
		return;
	}

	row.innerHTML = `
		<div class="col-12 col-lg-2 mb-3">
			<ul class="nav nav-pills flex-column creations-type-nav"></ul>
		</div>
		<div class="col-12 col-lg-10">
			<div class="input-group input-group-sm mb-3">
				<input type="text" class="form-control" placeholder="Search creations...">
				<button class="btn btn-secondary" type="button">
					<i class="fas fa-search"></i>
				</button>
			</div>
			<div class="creations-results"></div>
		</div>
	`;

	const typeNav = row.querySelector<HTMLUListElement>(".creations-type-nav")!;
	const results = row.querySelector<HTMLDivElement>(".creations-results")!;
	const searchInput = row.querySelector<HTMLInputElement>("input")!;
	const searchBtn = row.querySelector<HTMLButtonElement>("button")!;

	const presentTypes = [...new Set(assets.map((a) => a.type))].sort((a, b) => {
		const order = Object.keys(CREATION_TYPE_META);
		const ai = order.indexOf(a);
		const bi = order.indexOf(b);
		if (ai === -1 && bi === -1) return a.localeCompare(b);
		if (ai === -1) return 1;
		if (bi === -1) return -1;
		return ai - bi;
	});

	const addPill = (
		type: string,
		icon: string,
		label: string,
		count: number,
	) => {
		const li = document.createElement("li");
		li.classList.add("nav-item");

		const a = document.createElement("a");
		a.href = "#!";
		a.classList.add("nav-link");
		if (type === activeType) a.classList.add("active");

		const iconEl = document.createElement("i");
		iconEl.classList.add(...icon.split(" "), "me-1");
		a.appendChild(iconEl);

		const labelEl = document.createElement("span");
		labelEl.classList.add("pilltitle");
		labelEl.textContent = label;
		a.appendChild(labelEl);

		const badge = document.createElement("span");
		badge.classList.add("badge", "bg-secondary", "float-end");
		badge.textContent = String(count);
		a.appendChild(badge);

		a.addEventListener("click", (e) => {
			e.preventDefault();
			if (activeType === type) return;
			activeType = type;
			currentPage = 1;
			for (const link of typeNav.querySelectorAll(".nav-link"))
				link.classList.remove("active");
			a.classList.add("active");
			renderResults();
		});

		li.appendChild(a);
		typeNav.appendChild(li);
	};

	addPill("all", "fas fa-layer-group", "All", assets.length);
	for (const type of presentTypes) {
		addPill(
			type,
			creationTypeIcon(type),
			creationTypeLabel(type),
			assets.filter((a) => a.type === type).length,
		);
	}

	const renderPagination = (pages: number) => {
		const existing = results.querySelector(".creations-pagination");
		existing?.remove();
		if (pages <= 1) return;

		const items: string[] = [];
		const pageLink = (label: string, page: number, disabled = false) =>
			`<li class="page-item ${disabled ? "disabled" : ""}"><a class="page-link" href="#!" data-page="${page}">${label}</a></li>`;

		items.push(pageLink("«", 1, currentPage === 1));
		items.push(pageLink("‹", Math.max(1, currentPage - 1), currentPage === 1));

		const windowSize = 2;
		const start = Math.max(1, currentPage - windowSize);
		const end = Math.min(pages, currentPage + windowSize);

		if (start > 1) {
			items.push(pageLink("1", 1));
			if (start > 2)
				items.push(
					`<li class="page-item disabled"><a class="page-link">…</a></li>`,
				);
		}
		for (let p = start; p <= end; p++) {
			items.push(
				p === currentPage
					? `<li class="page-item active"><a class="page-link" href="#!" data-page="${p}">${p}</a></li>`
					: pageLink(String(p), p),
			);
		}
		if (end < pages) {
			if (end < pages - 1)
				items.push(
					`<li class="page-item disabled"><a class="page-link">…</a></li>`,
				);
			items.push(pageLink(String(pages), pages));
		}

		items.push(
			pageLink("›", Math.min(pages, currentPage + 1), currentPage === pages),
		);
		items.push(pageLink("»", pages, currentPage === pages));

		const nav = document.createElement("div");
		nav.classList.add(
			"creations-pagination",
			"d-flex",
			"justify-content-center",
			"mt-3",
		);
		nav.innerHTML = `<nav><ul class="pagination">${items.join("")}</ul></nav>`;
		nav.addEventListener("click", (e) => {
			const target = (e.target as HTMLElement).closest("a[data-page]");
			if (!target) return;
			e.preventDefault();
			const page = Number(target.getAttribute("data-page"));
			if (Number.isNaN(page) || page === currentPage) return;
			currentPage = page;
			renderResults();
		});
		results.appendChild(nav);
	};

	const renderResults = () => {
		activeAudio.current?.pause();
		activeAudio.current = null;

		let filtered =
			activeType === "all"
				? assets
				: assets.filter((a) => a.type === activeType);
		if (searchQuery) {
			const q = searchQuery.toLowerCase();
			filtered = filtered.filter((a) => a.name.toLowerCase().includes(q));
		}

		const pages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
		if (currentPage > pages) currentPage = pages;

		const grid = results.querySelector(".itemgrid");
		grid?.remove();
		results.querySelector(".creations-empty")?.remove();

		if (filtered.length === 0) {
			const empty = document.createElement("p");
			empty.classList.add(
				"text-muted",
				"text-center",
				"py-3",
				"creations-empty",
			);
			empty.textContent = searchQuery
				? `No creations match "${searchQuery}".`
				: "No creations in this category.";
			results.prepend(empty);
			renderPagination(0);
			return;
		}

		const pageItems = filtered.slice(
			(currentPage - 1) * ITEMS_PER_PAGE,
			currentPage * ITEMS_PER_PAGE,
		);

		const itemGrid = document.createElement("div");
		itemGrid.classList.add("row", "alignleft", "itemgrid");
		for (const asset of pageItems) {
			const col = document.createElement("div");
			col.classList.add("px-0");
			col.innerHTML = `
					<a href="/store/${asset.id}" class="text-reset">
						<div class="card mb-2">
							<div class="card-body"></div>
						</div>
						<h6 class="text-truncate mb-0"></h6>
					</a>
				`;
			const cardBody = col.querySelector<HTMLDivElement>(".card-body")!;
			if (asset.type === "audio") {
				cardBody.appendChild(createAudioPlayButton(asset.id, activeAudio));
			} else {
				const img = document.createElement("img");
				img.className = "img-fluid rounded";
				img.src = asset.thumbnail;
				img.alt = asset.name;
				cardBody.appendChild(img);
			}
			col.querySelector("h6")!.textContent = asset.name;
			itemGrid.appendChild(col);
		}
		results.prepend(itemGrid);

		renderPagination(pages);
		sendMessage("registerBootstrapElements");
	};

	const runSearch = () => {
		searchQuery = searchInput.value.trim();
		currentPage = 1;
		renderResults();
	};

	searchBtn.addEventListener("click", runSearch);
	searchInput.addEventListener("keydown", (e) => {
		if (e.key === "Enter") {
			e.preventDefault();
			runSearch();
		}
	});
	searchInput.addEventListener("input", () => {
		clearTimeout(searchDebounce);
		searchDebounce = setTimeout(runSearch, 200);
	});

	renderResults();
	sendMessage("registerBootstrapElements");
}

export async function creationsTab(userId: number) {
	const tabList = document.getElementById("user-info-tabs");
	if (!tabList) return;

	const navItem = document.createElement("li");
	navItem.classList.add("nav-item");
	navItem.setAttribute("role", "presentation");
	navItem.innerHTML = `
		<a class="nav-link" href="#!">
			<i class="fad fa-paint-brush me-1"></i> Creations
		</a>
	`;
	tabList.appendChild(navItem);

	navItem.querySelector("a")!.addEventListener("click", (e) => {
		e.preventDefault();
		window.history.pushState(
			null,
			"",
			`${window.location.pathname}?${CREATIONS_QUERY_PARAM}`,
		);
		showCreationsPage(userId);
	});

	if (new URLSearchParams(window.location.search).has(CREATIONS_QUERY_PARAM)) {
		await showCreationsPage(userId);
	}
}

export async function userAliases(
	userId: number,
	aliases: Record<number, string>,
	showDisclosures: boolean,
) {
	const dropdown = document.getElementsByClassName(
		"dropdown-menu dropdown-menu-right",
	)[0];

	const setAliasItem = document.createElement("a");
	setAliasItem.classList = "dropdown-item text-primary";
	setAliasItem.href = "#";
	setAliasItem.innerHTML = `
    <i class="fa-duotone fa-book"></i>
	(Kiln) Set Alias
    `;
	dropdown.appendChild(setAliasItem);

	setAliasItem.addEventListener("click", async () => {
		sendMessage("changeUserAlias", {
			userId,
			currentAlias: aliases[userId],
		});
	});

	if (aliases[userId]) {
		const username = document.querySelector(
			'.text-themeglow [class^="userlink-"]',
		) as HTMLSpanElement;

		const usernameLower = username.innerText.trim().toLowerCase();

		const sectionTitles = document.getElementsByClassName("section-title");
		for (const title of sectionTitles) {
			for (const node of title.childNodes) {
				if (node.nodeType !== Node.TEXT_NODE) continue;

				const text = node.textContent ?? "";
				if (text.trim().toLowerCase().includes(usernameLower)) {
					node.textContent = text
						.toLowerCase()
						.replace(usernameLower, aliases[userId])
						.toUpperCase();
				}
			}
		}

		username.innerText = aliases[userId];
		applyKilnDisclosureTitle(
			username,
			showDisclosures,
			"Display name overridden by a Kiln alias",
		);
	}
}

export async function userNotes(userId: number, showDisclosures: boolean) {
	const tabList = document.getElementById("user-info-tabs");
	const tabContent = document.querySelector(
		"#user-menu-tabs-card .tab-content",
	);
	if (!tabList || !tabContent) return;

	const navItem = document.createElement("li");
	navItem.classList.add("nav-item");
	navItem.setAttribute("role", "presentation");
	navItem.innerHTML = `
		<a class="nav-link" href="#!" data-bs-toggle="tab" role="tab"
		   data-bs-target="#user-notes" aria-controls="user-notes" aria-selected="false" tabindex="-1">
			<i class="fad fa-sticky-note me-1"></i> Notes
		</a>
	`;
	applyKilnDisclosureTitle(
		navItem.querySelector("a")!,
		showDisclosures,
		"Private notes (only visible to you)",
	);
	tabList.appendChild(navItem);

	const pane = document.createElement("div");
	pane.id = "user-notes";
	pane.classList.add("tab-pane", "fade");
	pane.setAttribute("role", "tabpanel");

	const notes = await _userNotes.getValue();
	const savedNote = notes[userId] ?? "";

	pane.innerHTML = `<textarea class="form-control bg-dark mb-3" rows="8" placeholder="Write anything...">${savedNote}</textarea><small class="save-status text-muted"></small>`;
	tabContent.appendChild(pane);

	const textarea = pane.querySelector<HTMLTextAreaElement>("textarea")!;
	const status = pane.querySelector<HTMLElement>(".save-status")!;
	let debounce: ReturnType<typeof setTimeout>;

	textarea.addEventListener("input", () => {
		clearTimeout(debounce);
		status.textContent = "Saving...";
		debounce = setTimeout(async () => {
			const current = await _userNotes.getValue();
			if (textarea.value) {
				current[userId] = textarea.value;
			} else {
				delete current[userId];
			}
			await _userNotes.setValue(current);
			status.textContent = "Saved";
			setTimeout(() => {
				status.textContent = "";
			}, 2000);
		}, 500);
	});
}

export async function avatarMeshDownloader(userId: number) {
	const { AvatarRenderer } = await import(
		"@/entrypoints/account.content/avatarRenderer"
	);

	const dropdown = document.getElementsByClassName(
		"dropdown-menu dropdown-menu-right",
	)[0];
	if (!dropdown) return;

	const downloadAvatarMesh = async () => {
		const avatarResult = await sendMessage("getUserAvatar", userId);
		if (!avatarResult.ok) return;
		const { colors, assets } = avatarResult.data;

		const canvas = document.createElement("canvas");
		canvas.width = canvas.height = 1;
		const renderer = new AvatarRenderer(canvas);

		await renderer.load({
			useCharacter: false,
			headColor: `#${colors.head}`,
			torsoColor: `#${colors.torso}`,
			leftArmColor: `#${colors.leftArm}`,
			rightArmColor: `#${colors.rightArm}`,
			leftLegColor: `#${colors.leftLeg}`,
			rightLegColor: `#${colors.rightLeg}`,
			face: assets.find((a) => a.type === "face")?.path,
			clothing: assets
				.filter((a) => a.type === "clothing" && a.path.endsWith(".png"))
				.map((a) => a.path),
			body: assets.find((a) => a.type === "body")?.path,
			tool: assets.find((a) => a.type === "tool")?.path,
			items: assets.filter((a) => a.type === "hat").map((a) => a.path),
		});

		const glb = await renderer.exportGLB();
		renderer.dispose();

		const a = Object.assign(document.createElement("a"), {
			href: URL.createObjectURL(new Blob([glb], { type: "model/gltf-binary" })),
			download: `polytoria-avatar-${userId}.glb`,
		});
		a.click();
		URL.revokeObjectURL(a.href);
	};

	const downloadItem = document.createElement("a");
	downloadItem.classList.add("dropdown-item", "text-primary");
	downloadItem.href = "#";
	downloadItem.innerHTML = `
    <i class="fa-duotone fa-cube"></i>
	(Kiln) Download Avatar Mesh
    `;
	dropdown.appendChild(downloadItem);

	downloadItem.addEventListener("click", async (e) => {
		e.preventDefault();
		downloadItem.classList.remove("text-primary");
		downloadItem.innerHTML = `
        <i class="fa-duotone fa-spinner fa-spin"></i>
		(Kiln) Downloading...
        `;
		await downloadAvatarMesh();
		downloadItem.innerHTML = `
        <i class="fa-duotone fa-cube"></i>
		(Kiln) Download Avatar Mesh
        `;
		downloadItem.classList.add("text-primary");
	});
}

export async function rankingPositions(
	userId: number,
	showDisclosures: boolean,
) {
	const chartResults = await sendMessage("getUserCharts", userId);
	const charts = chartResults.ok
		? (chartResults.data as PolyTrack.UserChartsApi)
		: null;

	if (!charts) return;

	const rows: [string, string, string | undefined][] = [
		[
			"fa-duotone fa-coin",
			"Networth",
			charts.data.networth?.filter((x) => x._field == "rank").at(-1)?._value,
		],
		[
			"fa-duotone fa-eye",
			"Profile Views",
			charts.data.profileviews?.filter((x) => x._field == "rank").at(-1)
				?._value,
		],
		[
			"fa-duotone fa-flag-checkered",
			"Visits",
			charts.data.visits?.filter((x) => x._field == "rank").at(-1)?._value,
		],
		[
			"fa-duotone fa-messages",
			"Forum Posts",
			charts.data.forumposts?.filter((x) => x._field == "rank").at(-1)?._value,
		],
		[
			"fa-duotone fa-tag",
			"Sales",
			charts.data.sales?.filter((x) => x._field == "rank").at(-1)?._value,
		],
		[
			"fa-duotone fa-star",
			"XP",
			charts.data.xp?.filter((x) => x._field == "rank").at(-1)?._value,
		],
	];

	const hasData = rows.some(([, , value]) => value != null);
	if (!hasData) return;

	const section = document.createElement("div");
	section.innerHTML = `
	<h6 class="section-title px-3 px-lg-0 mt-4">
		<i class="fas fa-ranking-star me-1"></i> Ranking Positions${kilnDisclosureBadgeHtml(showDisclosures)}
	</h6>
	<div class="card mcard card-themed mb-4">
		<div class="card-body">
			${rows
				.filter(([, , value]) => value != null)
				.map(
					([icon, label, value]) => `
				<div class="mb-1">
					<b><i class="${icon}" style="width:1em;text-align:center"></i> ${label}</b>
					<span class="float-end">#${value}</span>
				</div>`,
				)
				.join("")}
		</div>
	</div>
	`;

	document.getElementsByClassName("user-right")[0].appendChild(section);
	sendMessage("registerBootstrapElements");
}
