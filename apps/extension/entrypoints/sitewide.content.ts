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

import "@/public/css/specific.css";

import plusIcon from "@/assets/plus.svg";
import plusDeluxeIcon from "@/assets/plusDx.svg";
import _preferencesJson from "@/public/preferences.json";

const preferencesData = _preferencesJson.preferences;

import type { FeatureId } from "@/utils/featureIds.generated";
import { PATH_FEATURES } from "@/utils/featurePaths.generated";
import { _savedThemes, preferences } from "@/utils/storage";
import { applyKilnTheme, THEME_PRESETS } from "@/utils/theme";
import type { CurrencyCode } from "@/utils/types";
import {
	bricksToCurrency,
	getApiSession,
	getUserDetails,
	injectNoticeBanners,
	injectPostUpdateBanner,
	injectUpdateBanner,
} from "@/utils/utilities";

export default defineContentScript({
	matches: ["https://polytoria.com/*"],
	runAt: "document_start",
	async main() {
		const isProfilePage = /^\/(u\/[^/]+|users\/\d+)\/?$/.test(
			location.pathname,
		);
		if (!isProfilePage) {
			const values = await preferences.getPreferences();
			if (values.enabled.includes("themeCreator")) {
				const activeId = values.config.themeCreator.activeThemeId || "default";
				if (activeId !== "default") {
					if (activeId in THEME_PRESETS) {
						applyKilnTheme(THEME_PRESETS[activeId]);
					} else {
						const saved = await _savedThemes.getValue();
						const theme = saved.find((t) => t.id === activeId);
						applyKilnTheme(theme ?? null);
					}
				}
			}

			if (values.enabled.includes("legacySidebar")) {
				const style = document.createElement("style");
				style.textContent =
					".navbar.navbar-expand-lg.navbar-light.bg-navbar.nav-secondary { display: none !important; }" +
					"main { overflow-x: clip; }";
				(document.head || document.documentElement).appendChild(style);

				const observer = new MutationObserver(async () => {
					const mainContent = document.getElementById("main-content");
					if (mainContent?.parentElement) {
						observer.disconnect();
						if (!mainContent.parentElement.querySelector(".nav-sidebar-cont")) {
							mainContent.parentElement.prepend(
								createSidebarElement(
									values.config.legacySidebar.membershipStyle,
									values.config.legacySidebar.showUpgradeBtn,
								),
							);
						}
						getUserDetails().then((user) => {
							if (!user) return;
							const invLink = document.querySelector<HTMLAnchorElement>(
								".nav-sidebar-cont a[data-inventory]",
							);
							if (invLink) invLink.href = `/users/${user.userId}/inventory/`;
						});
					}
				});
				observer.observe(document.documentElement, {
					childList: true,
					subtree: true,
				});
			}
		}

		const onDOMReady = () => {
			document.body.setAttribute("data-URL", window.location.pathname);

			injectNoticeBanners();
			injectPostUpdateBanner();
			injectUpdateBanner();
			injectKilnSettingsLink();
			getUserDetails().then((user) => {
				if (!user) {
					console.warn("[Kiln] Failure to get logged in user details.");
					return;
				}

				if (import.meta.env.MODE == "development")
					console.info("[Kiln] Logged in as: ", user);

				getApiSession(user.userId).then((state) => {
					if (state == null) {
						injectVerificationBanner();
					}
				});

				preferences.getPreferences().then(async (values) => {
					footerInjectionInfo(values.enabled);

					if (values.enabled.includes("localizedTimestamps")) {
						localizedTimestamps();
					}

					if (values.enabled.includes("stickyNavbar")) {
						stickyNavbar();
					}

					if (values.enabled.includes("hideNotificationBadges")) {
						const badges = document.querySelectorAll(
							".nav-secondary .nav-link .badge",
						);
						for (const badge of Array.from(badges)) {
							badge.remove();
						}
					}

					if (values.enabled.includes("hideUserAds")) {
						const adSelectors = [
							{ enabled: values.config.hideUserAds.banners, width: "728px" },
							{ enabled: values.config.hideUserAds.rectangles, width: "300px" },
						];

						for (const { enabled, width } of adSelectors) {
							if (!enabled) continue;
							for (const a of document.querySelectorAll(
								`div[style^="max-width: ${width};"] a[href^="/ads"]`,
							)) {
								a.closest(`div[style^="max-width: ${width};"]`)?.remove();
							}
						}
					}

					if (values.enabled.includes("membershipThemes")) {
						membershipThemes(values.config.membershipThemes.themeId);
					}

					if (values.enabled.includes("legacySidebar")) {
						legacySidebar(
							values.config.legacySidebar.membershipStyle,
							values.config.legacySidebar.showUpgradeBtn,
						);
					}

					const isProfilePage = /^\/(u\/[^/]+|users\/\d+)\/?$/.test(
						location.pathname,
					);
					if (
						values.enabled.includes("themeCreator") &&
						(!isProfilePage || !profileBlocksTheme())
					) {
						const activeId =
							values.config.themeCreator.activeThemeId || "default";
						if (activeId !== "default") {
							if (activeId in THEME_PRESETS) {
								applyKilnTheme(THEME_PRESETS[activeId]);
							} else {
								const saved = await _savedThemes.getValue();
								const theme = saved.find((t) => t.id === activeId);
								applyKilnTheme(theme ?? null);
							}
						}
					}

					if (values.enabled.includes("irlBrickPrice")) {
						const currency = await bricksToCurrency(
							user.bricks,
							values.config.irlBrickPrice.currency as CurrencyCode,
						);

						if (currency) {
							const brickBalance = document
								.querySelector('.navbar [data-bs-html="true"]')!
								.getElementsByTagName("span")[0]!;

							brickBalance.innerHTML += ` (${currency})`;
						}
					}

					if (values.enabled.includes("userAliases")) {
						_userAliases.getValue().then((aliases) => {
							userAliases(user.userId, aliases);
						});
					}

					if (values.enabled.includes("friendReqNotifActions")) {
						friendReqNotifActions();
					}
				});
			});

			import("@/utils/themeEditorSidebar").then((m) =>
				m.restoreThemeEditorIfNeeded(),
			);
			if (
				new URLSearchParams(window.location.search).has("kiln-theme-editor")
			) {
				import("@/utils/themeEditorSidebar").then((m) =>
					m.openThemeEditorSidebar(),
				);
			}
		};

		if (document.readyState === "loading") {
			document.addEventListener("DOMContentLoaded", onDOMReady, { once: true });
		} else {
			onDOMReady();
		}
	},
});

const THEME_BLOCKING_ITEM_IDS = new Set([
	151140, 43548, 35699, 34715, 34698, 34419, 34418, 34416, 34392, 34391, 34390,
	34389, 34380, 34379,
]);

function profileBlocksTheme(): boolean {
	const card = document.querySelector("#user-equipped-items-card");
	if (!card) return false;
	return Array.from(
		card.querySelectorAll<HTMLAnchorElement>('a[href^="/store/"]'),
	).some((a) => {
		const match = a.getAttribute("href")?.match(/\/store\/(\d+)/);
		return match ? THEME_BLOCKING_ITEM_IDS.has(+match[1]) : false;
	});
}

function injectKilnSettingsLink() {
	const settingsLink = document.querySelector(
		'.dropdown-menu-end a[href="/my/settings"]',
	);
	if (!settingsLink) return;

	settingsLink.insertAdjacentHTML(
		"afterend",
		`<a href="/my/settings/kiln" class="text-reset text-decoration-none">
			<li class="dropdown-item">
				<i class="fad fa-fire me-1"></i>
				Kiln
			</li>
		</a>`,
	);
}

/**
 * Applies the specified membership's theme to the sitewide navigation.
 * @param themeId The ID of the membership whose theme should be applied.
 */
function membershipThemes(themeId: "plus" | "plusdx") {
	const navbar = document.querySelector(
		".navbar.navbar-expand-lg.navbar-light.bg-navbar.nav-topbar",
	)!;
	const secondaryNavbar = document.querySelector(
		".navbar.navbar-expand-lg.navbar-light.bg-navbar.nav-secondary",
	)!;

	navbar.classList.add(`navbar-${themeId}`);
	secondaryNavbar.classList.add(`navbar-${themeId}`);

	const logo = navbar.getElementsByClassName("navbar-brand")[0]!
		.children[0] as HTMLImageElement;
	if (themeId == "plus") {
		logo.src = plusIcon;
	} else {
		logo.src = plusDeluxeIcon;
	}
}

function createSidebarElement(
	membershipStyle: "free" | "plus" | "plusdx",
	showUpgradeBtn: boolean = true,
) {
	const freeLogo = "B17Jdbl0.svg";
	const logoUrl = `https://cdn.polytoria.com/static/icon-${freeLogo}`;

	const logoFilters: Record<"free" | "plus" | "plusdx", string> = {
		free: "",
		plus: "invert(1) sepia(1) saturate(5) hue-rotate(160deg) brightness(1.1)",
		plusdx: "invert(1) sepia(1) saturate(8) hue-rotate(240deg) brightness(0.9)",
	};

	const filter = logoFilters[membershipStyle];

	const sidebar = document.createElement("div");
	sidebar.classList.add("nav-sidebar-cont", "d-lg-flex", "d-none");
	sidebar.innerHTML = `
	<div class="d-flex flex-column flex-shrink-0 bg-sidebar nav-sidebar ${
		membershipStyle == "plus" || membershipStyle == "plusdx"
			? `sidebar-${membershipStyle}`
			: ""
	}">
		<a href="https://polytoria.com/" class="d-block p-3 link-dark text-decoration-none mb-2">
			<img src="${logoUrl}" class="img-fluid"${filter ? ` style="filter: ${filter};"` : ""}>
			${
				membershipStyle == "plus" || membershipStyle == "plusdx"
					? `<div class="n${membershipStyle}-banner">
            	<i class="pi pi-${membershipStyle}" style="margin-right:-0.4em"></i>
            </div>`
					: ""
			}
		</a>
		<ul class="nav nav-flush flex-column mb-auto text-center">
			<li class="nav-item">
				<a href="https://polytoria.com/home" class="nav-link py-1 nav-sidebar-link">
					<div class="nav-sidebar-button">
						<i class="far fa-home"></i>
					</div>
					<div class="nav-sidebar-text">
						<span>Home</span>
					</div>
				</a>
			</li>
			<li class="nav-item">
				<a href="https://polytoria.com/my/avatar" class="nav-link py-1 nav-sidebar-link">
					<div class="nav-sidebar-button">
						<i class="far fa-user-crown"></i>
					</div>
					<div class="nav-sidebar-text">
						<span>Avatar</span>
					</div>
				</a>
			</li>
			<li class="nav-item">
				<a href="/my/inventory" data-inventory class="nav-link py-1 nav-sidebar-link">
					<div class="nav-sidebar-button">
						<i class="far fa-backpack"></i>
					</div>
					<div class="nav-sidebar-text">
						<span>Inventory</span>
					</div>
				</a>
			</li>
			<li class="nav-item">
				<a href="https://polytoria.com/create/" class="nav-link py-1 nav-sidebar-link">
					<div class="nav-sidebar-button">
						<i class="far fa-screwdriver-wrench"></i>
					</div>
					<div class="nav-sidebar-text">
						<span>Create</span>
					</div>
				</a>
			</li>
			<li class="nav-item">
				<a href="https://polytoria.com/my/friends" class="nav-link py-1 nav-sidebar-link">
					<div class="nav-sidebar-button">
						<i class="far fa-users"></i>
					</div>
					<div class="nav-sidebar-text">
						<span>Friends</span>
					</div>
				</a>
			</li>
			<li class="nav-item">
				<a href="https://polytoria.com/inbox/" class="nav-link py-1 nav-sidebar-link">
					<div class="nav-sidebar-button">
						<i class="far fa-mailbox"></i>
					</div>
					<div class="nav-sidebar-text">
						<span>Inbox</span>
					</div>
				</a>
			</li>
			<li class="nav-item">
				<a href="https://polytoria.com/trade/" class="nav-link py-1 nav-sidebar-link">
					<div class="nav-sidebar-button">
						<i class="far fa-handshake"></i>
					</div>
					<div class="nav-sidebar-text">
						<span>Trades</span>
					</div>
				</a>
			</li>
			<li class="nav-item">
				<a href="https://polytoria.com/rankings/" class="nav-link py-1 nav-sidebar-link">
					<div class="nav-sidebar-button">
						<i class="far fa-ranking-star"></i>
					</div>
					<div class="nav-sidebar-text">
						<span>Rankings</span>
					</div>
				</a>
			</li>
		</ul>
		${
			showUpgradeBtn
				? `<div class="d-flex align-items-center justify-content-center text-center">
			<a style="overflow: initial" href="https://polytoria.com/upgrade" class="nav-link py-1 nav-sidebar-link">
				<div class="nav-sidebar-button nav-sidebar-upgrade-button d-flex justify-content-center align-items-center">
					<i class="pi pi-plus" style="margin-bottom:13px;"></i>
				</div>
				<div class="nav-sidebar-text">
					<span>Upgrade</span>
				</div>
			</a>
		</div>`
				: ""
		}
	</div>
`;
	return sidebar;
}

function legacySidebar(
	membershipStyle: "free" | "plus" | "plusdx",
	showUpgradeBtn: boolean = false,
) {
	if (!document.querySelector(".nav-sidebar-cont")) {
		const pageContent = document.getElementById("main-content")!.parentElement;
		pageContent!.prepend(createSidebarElement(membershipStyle, showUpgradeBtn));
	}

	copySidebarBadges();

	const navbar = document.querySelector(
		".navbar.navbar-expand-lg.navbar-light.bg-navbar.nav-topbar",
	)!;
	navbar.getElementsByClassName("navbar-brand")[0].remove();

	document
		.querySelector(
			".navbar.navbar-expand-lg.navbar-light.bg-navbar.nav-secondary",
		)
		?.remove();
}

function copySidebarBadges() {
	const sidebar = document.querySelector<HTMLElement>(".nav-sidebar-cont");
	if (!sidebar) return;

	const secondaryLinks = document.querySelectorAll<HTMLAnchorElement>(
		".navbar.nav-secondary .navbar-nav a.nav-link",
	);

	for (const navLink of secondaryLinks) {
		const badge = navLink.querySelector<HTMLElement>(".badge");
		if (!badge) continue;

		const href = navLink.getAttribute("href");
		if (!href) continue;

		const normalizedPath = href.replace(/^\/|\/$/g, "");

		const sidebarLink = Array.from(
			sidebar.querySelectorAll<HTMLAnchorElement>("a.nav-sidebar-link"),
		).find((a) => {
			const sHref = (a.getAttribute("href") ?? "")
				.replace(/^https?:\/\/[^/]+/, "")
				.replace(/^\/|\/$/g, "");
			return sHref === normalizedPath;
		});

		if (!sidebarLink) continue;

		const cloned = badge.cloneNode(true) as HTMLElement;
		cloned.classList.add("notif-nav", "notif-sidebar");
		sidebarLink.appendChild(cloned);
	}
}

function footerInjectionInfo(enabledIds: FeatureId[]) {
	const footerInfoContainer = document.querySelector(
		".footer-container .col-12:has(img)",
	);
	if (!footerInfoContainer) return;

	const currentUrl = window.location.href;

	const activeFeatureIds = Object.entries(PATH_FEATURES)
		.filter(([pattern]) => {
			const regex = new RegExp(`^${pattern.replace(/\*/g, ".*")}$`);
			return regex.test(currentUrl);
		})
		.flatMap(([, features]) => features)
		.filter((id) => enabledIds.includes(id as FeatureId));

	const pathCount = (id: string) =>
		Object.values(PATH_FEATURES).filter((features) =>
			(features as readonly string[]).includes(id),
		).length;

	const activeNames = preferencesData
		.filter((pref) => activeFeatureIds.includes(pref.id as any))
		.sort((a, b) => {
			const diff = pathCount(a.id) - pathCount(b.id);
			return diff !== 0 ? diff : a.name.localeCompare(b.name);
		})
		.map((pref) => pref.name);

	const injectionInfo = document.createElement("small");
	injectionInfo.classList.add("d-block", "text-muted", "mt-3");
	injectionInfo.style.fontSize = "0.7rem";
	injectionInfo.innerText = `Kiln has added the following feature(s) to the current page: ${activeNames.join(", ")}`;

	footerInfoContainer.appendChild(injectionInfo);
}

function userAliases(userId: number, aliases: Record<number, string>) {
	const getUserId = (link: HTMLElement): number | null => {
		const ownHref = link.getAttribute("href");
		if (ownHref) {
			const match = ownHref.match(/^\/users\/(\d+)/);
			if (match) return +match[1];
		}

		const ancestorHref = link.closest("a")?.getAttribute("href");
		if (ancestorHref) {
			const match = ancestorHref.match(/^\/users\/(\d+)/);
			if (match) return +match[1];
		}

		return null;
	};

	const processUserLink = (link: HTMLElement) => {
		const id = getUserId(link);
		if (id === null) return;

		const alias = aliases[id];
		if (!alias) return;

		if (!link.matches('a[href^="/users/"]')) {
			if (!link.textContent?.trim()) return;
			link.innerText = alias;
			return;
		}

		const textNodes = Array.from(link.childNodes).filter(
			(n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim(),
		);
		if (textNodes.length === 0) return;

		textNodes[0].textContent = alias;
		for (const node of textNodes.slice(1)) node.remove();
	};

	const processHomeTitle = () => {
		const alias = aliases[userId];
		if (!alias) return;

		const span = document.querySelector<HTMLElement>(
			"h3.home-title2 span.text-truncate",
		);
		if (span?.textContent?.trim()) span.innerText = alias;
	};

	for (const link of document.querySelectorAll<HTMLElement>(
		'a [class^="userlink-"]',
	)) {
		processUserLink(link);
	}

	for (const link of document.querySelectorAll<HTMLAnchorElement>(
		'a[href^="/users/"]',
	)) {
		processUserLink(link);
	}

	processHomeTitle();

	const observer = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			for (const node of mutation.addedNodes) {
				if (!(node instanceof HTMLElement)) continue;

				const candidates: HTMLElement[] = [];

				if (node.matches('a [class^="userlink-"]')) candidates.push(node);
				candidates.push(
					...node.querySelectorAll<HTMLElement>('a [class^="userlink-"]'),
				);

				if (node.matches('a[href^="/users/"]')) candidates.push(node);
				candidates.push(
					...node.querySelectorAll<HTMLElement>('a[href^="/users/"]'),
				);

				for (const candidate of candidates) {
					processUserLink(candidate);
				}

				if (
					node.matches("h3.home-title2") ||
					node.querySelector("h3.home-title2")
				) {
					processHomeTitle();
				}
			}
		}
	});

	observer.observe(document.body, { childList: true, subtree: true });
}

function friendReqNotifActions() {
	const popup = document.querySelector<HTMLElement>(".notifications-popup");
	if (!popup) {
		console.warn("[Kiln] .notifications-popup not found");
		return;
	}

	let activePopout: HTMLElement | null = null;
	let activeAnchor: HTMLAnchorElement | null = null;

	function createPopout(username: string, notifUrl: string): HTMLElement {
		const popout = document.createElement("div");
		Object.assign(popout.style, {
			position: "fixed",
			background: "rgb(37,37,37)",
			border: "3px solid rgb(71,71,71)",
			borderRadius: "10px",
			padding: "12px 14px",
			width: "200px",
			boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
			zIndex: "99999",
			pointerEvents: "all",
		});

		const viewProfileBtn = document.createElement("button");
		viewProfileBtn.className = "btn btn-primary btn-sm w-100 mb-1";
		viewProfileBtn.innerHTML = "View Profile";

		const acceptBtn = document.createElement("button");
		acceptBtn.className = "btn btn-success btn-sm w-100 mb-1";
		acceptBtn.innerHTML = '<i class="fa-solid fa-check"></i> Accept';

		const declineBtn = document.createElement("button");
		declineBtn.className = "btn btn-danger btn-sm w-100";
		declineBtn.innerHTML = '<i class="fa-solid fa-x"></i> Decline';

		const resolveUserId = async (): Promise<number | null> => {
			const urlMatch = notifUrl.match(/\/users\/(\d+)/);
			if (urlMatch) return +urlMatch[1];
			const user = await sendMessage("findUserByUsername", username);
			return user.ok ? user.data : null;
		};

		const setLoading = (loading: boolean) => {
			acceptBtn.disabled = loading;
			declineBtn.disabled = loading;
		};

		viewProfileBtn.addEventListener("click", async (e) => {
			e.preventDefault();
			e.stopPropagation();
			setLoading(true);
			const userId = await resolveUserId();
			if (userId === null) {
				setLoading(false);
				return;
			}
			window.location.href = `https://polytoria.com/users/${userId}`;
		});

		acceptBtn.addEventListener("click", async (e) => {
			e.preventDefault();
			e.stopPropagation();
			setLoading(true);
			const userId = await resolveUserId();
			if (userId === null) {
				setLoading(false);
				return;
			}
			const result = await sendMessage("acceptFriendRequest", userId);
			if (result.ok) closePopout();
			else setLoading(false);
		});

		declineBtn.addEventListener("click", async (e) => {
			e.preventDefault();
			e.stopPropagation();
			setLoading(true);
			const userId = await resolveUserId();
			if (userId === null) {
				setLoading(false);
				return;
			}
			const result = await sendMessage("declineFriendRequest", userId);
			if (result.ok) closePopout();
			else setLoading(false);
		});

		popout.appendChild(viewProfileBtn);
		popout.appendChild(acceptBtn);
		popout.appendChild(declineBtn);
		return popout;
	}

	function positionPopout(
		popout: HTMLElement,
		anchor: HTMLAnchorElement,
	): void {
		const rect = anchor.getBoundingClientRect();
		const popoutWidth = 200;
		const gap = 10;
		popout.style.top = `${rect.top + rect.height / 2 - 60}px`;
		popout.style.left = `${rect.left - popoutWidth - gap}px`;
	}

	function closePopout(): void {
		activePopout?.remove();
		activePopout = null;
		activeAnchor = null;
	}

	function isFriendRequestNotif(anchor: HTMLAnchorElement): boolean {
		return /has sent you a friend request/i.test(anchor.textContent ?? "");
	}

	function extractUsername(anchor: HTMLAnchorElement): string {
		const textNode = anchor.querySelector<HTMLElement>("div > div:first-child");
		if (textNode) {
			return (textNode.textContent ?? "")
				.replace(/\s*has sent you a friend request\.?\s*/i, "")
				.trim();
		}

		return (anchor.textContent ?? "")
			.replace(/\s*has sent you a friend request\.?\s*/i, "")
			.replace(/\s*\d+\s+\w+\s+ago\s*/i, "")
			.replace(/\s+/g, " ")
			.trim();
	}

	popup
		.querySelectorAll<HTMLAnchorElement>("a.text-reset")
		.forEach((anchor) => {
			if (!isFriendRequestNotif(anchor)) return;

			anchor.addEventListener("click", (e) => {
				e.preventDefault();
				e.stopPropagation();

				if (activePopout && activeAnchor === anchor) {
					closePopout();
					return;
				}

				closePopout();

				const popout = createPopout(
					extractUsername(anchor),
					anchor.getAttribute("href") ?? "",
				);
				document.body.appendChild(popout);
				positionPopout(popout, anchor);
				activePopout = popout;
				activeAnchor = anchor;
			});
		});

	document.addEventListener("click", (e) => {
		if (!activePopout) return;
		const target = e.target as Node;
		if (!activePopout.contains(target) && !activeAnchor?.contains(target)) {
			closePopout();
		}
	});
}

function localizedTimestamps(): void {
	const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

	const MONTHS_FULL = [
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
	];
	const MONTHS_ABBR = [
		"Jan",
		"Feb",
		"Mar",
		"Apr",
		"May",
		"Jun",
		"Jul",
		"Aug",
		"Sep",
		"Oct",
		"Nov",
		"Dec",
	];

	function monthIndexFromFull(name: string): number {
		return MONTHS_FULL.findIndex((m) => m.toLowerCase() === name.toLowerCase());
	}
	function monthIndexFromAbbr(name: string): number {
		return MONTHS_ABBR.findIndex(
			(m) => m.toLowerCase() === name.slice(0, 3).toLowerCase(),
		);
	}

	function getParts(date: Date, tz: string, opts: Intl.DateTimeFormatOptions) {
		const parts = new Intl.DateTimeFormat("en-US", {
			timeZone: tz,
			...opts,
		}).formatToParts(date);
		return (type: string) => parts.find((p) => p.type === type)?.value ?? "";
	}

	function formatLongAmPm(date: Date, tz: string): string {
		const get = getParts(date, tz, {
			year: "numeric",
			month: "long",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
			hour12: true,
		});
		return `${get("month")} ${get("day")}, ${get("year")} - ${get("hour")}:${get("minute")}:${get("second")} ${get("dayPeriod").toUpperCase()}`;
	}

	function formatShort24h(date: Date, tz: string): string {
		const get = getParts(date, tz, {
			year: "numeric",
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
			hourCycle: "h23",
		});
		return `${get("day")} ${get("month")} ${get("year")}, ${get("hour")}:${get("minute")}`;
	}

	type PatternDef = {
		regex: RegExp;
		parse: (match: RegExpExecArray) => Date | null;
		format: (date: Date, tz: string) => string;
	};

	const PATTERNS: PatternDef[] = [
		{
			regex:
				/([A-Za-z]+) (\d{1,2}), (\d{4}) - (\d{1,2}):(\d{2}):(\d{2}) (AM|PM)/,
			parse: (m) => {
				const monthIndex = monthIndexFromFull(m[1]);
				if (monthIndex === -1) return null;
				let hour = parseInt(m[4], 10);
				const ampm = m[7].toUpperCase();
				if (ampm === "PM" && hour !== 12) hour += 12;
				if (ampm === "AM" && hour === 12) hour = 0;
				return new Date(
					Date.UTC(
						parseInt(m[3], 10),
						monthIndex,
						parseInt(m[2], 10),
						hour,
						parseInt(m[5], 10),
						parseInt(m[6], 10),
					),
				);
			},
			format: formatLongAmPm,
		},
		{
			regex: /(\d{1,2}) ([A-Za-z]{3,9}) (\d{4}), (\d{2}):(\d{2})/,
			parse: (m) => {
				const monthIndex = monthIndexFromAbbr(m[2]);
				if (monthIndex === -1) return null;
				return new Date(
					Date.UTC(
						parseInt(m[3], 10),
						monthIndex,
						parseInt(m[1], 10),
						parseInt(m[4], 10),
						parseInt(m[5], 10),
						0,
					),
				);
			},
			format: formatShort24h,
		},
	];

	function localizeRaw(raw: string): string | null {
		for (const pattern of PATTERNS) {
			const match = pattern.regex.exec(raw);
			if (!match) continue;

			const date = pattern.parse(match);
			if (!date || Number.isNaN(date.getTime())) continue;

			const localized = pattern.format(date, timezone);
			return (
				raw.slice(0, match.index) +
				localized +
				raw.slice(match.index + match[0].length)
			);
		}
		return null;
	}

	let updatedAny = false;

	document
		.querySelectorAll<HTMLElement>('[data-bs-toggle="tooltip"]')
		.forEach((el) => {
			const raw =
				el.getAttribute("data-bs-original-title") ||
				el.getAttribute("data-bs-title") ||
				el.getAttribute("title");

			if (!raw) return;

			const localized = localizeRaw(raw);
			if (!localized) return;

			el.setAttribute("data-bs-original-title", localized);
			el.setAttribute("title", localized);
			if (el.hasAttribute("data-bs-title")) {
				el.setAttribute("data-bs-title", localized);
			}

			updatedAny = true;
		});

	if (updatedAny) {
		sendMessage("registerBootstrapElements");
	}
}

function stickyNavbar() {
	const navbar = document.querySelector(
		".navbar.navbar-expand-lg.navbar-light.bg-navbar.nav-topbar",
	)! as HTMLElement;

	const secondaryNavbar = document.querySelector(
		".navbar.navbar-expand-lg.navbar-light.bg-navbar.nav-secondary",
	) as HTMLElement | null;

	Object.assign(navbar.style, {
		position: "sticky",
		top: "0",
		zIndex: 2001,
	});

	if (secondaryNavbar) {
		Object.assign(secondaryNavbar.style, {
			position: "sticky",
			// * I'm not sure if there is a more consistent way to do this with multiple sticky elements other than parenting them together and making that parent element sticky
			top: "4%",
			zIndex: 2000,
		});
	}
}