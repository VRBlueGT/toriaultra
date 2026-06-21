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

import type { Extension } from "@kiln/schemas";
import fallbackConfig from "./static/fallbackConfig.json";
import fallbackCurrencyRates from "./static/fallbackCurrencyRates.json";
import staticMetadata from "./static/metadata.json";
import { apiSessions, cache, dismissedNotices } from "./storage";
import type {
	ApiSession,
	CacheInterface,
	CurrencyCode,
	UserDetails,
} from "./types";

/*
  Extension
*/
export async function getConfig(): Promise<Extension.ExtensionConfig> {
	const result = await sendMessage("getConfig").catch(() => null);
	if (result?.ok) return result.data;

	if (import.meta.env.MODE == "development") {
		console.warn(
			"[Kiln] Couldn't reach remote server, using fallback config..",
		);
	}
	return fallbackConfig;
}

export function getApiUrl(
	apiName: keyof typeof staticMetadata.endpoints,
	flags?: Record<string, boolean>,
): string {
	if (apiName === "public" && getFlag(flags, "apis.usePublicApiProxy", false)) {
		return staticMetadata.endpoints.proxy;
	}
	if (apiName === "extension" && import.meta.env.MODE === "development") {
		return "http://localhost:3000/v1/";
	}
	return staticMetadata.endpoints[apiName];
}

export async function getApiSession(
	userId: number,
): Promise<ApiSession | null> {
	const sessionStore = await apiSessions.getValue();
	const session = sessionStore.find((s: ApiSession) => s.userId == userId);

	return session || null;
}

export async function updateApiSession(
	userId: number,
	mutate: (session: ApiSession) => void,
): Promise<ApiSession> {
	const sessionStore = await apiSessions.getValue();
	const session = sessionStore.find((s: ApiSession) => s.userId == userId)!;

	mutate(session);
	await apiSessions.setValue(sessionStore);

	return session;
}

let _currencyRatesPromise: Promise<Extension.CurrencyExchangeRate> | null =
	null;
let _currencyRatesExpiry = 0;

export function getCurrencyRates(): Promise<Extension.CurrencyExchangeRate> {
	const now = Date.now();
	if (_currencyRatesPromise && now < _currencyRatesExpiry) {
		return _currencyRatesPromise;
	}
	_currencyRatesExpiry = now + 24 * 60 * 60 * 1000;
	_currencyRatesPromise = (async () => {
		try {
			const result = (await pullCache(
				"currencyRates",
				async () => {
					const r = await sendMessage("getCurrencyRates");
					if (!r.ok) return "unavailable";
					return r.data;
				},
				24 * 60 * 60 * 1000,
				false,
			)) as Extension.CurrencyExchangeRate | "unavailable";

			if (result !== "unavailable") return result;
		} catch (_err) {}

		if (import.meta.env.MODE == "development") {
			console.warn(
				"[Kiln] Couldn't reach remote server, using fallback currency rates..",
			);
		}
		return fallbackCurrencyRates;
	})();
	return _currencyRatesPromise;
}

export function renderMarkdownLinks(
	message: string,
	linkClass = "text-black",
): string {
	return message.replace(
		/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
		(_, label, url) =>
			`<a href="${url}" target="_blank" rel="noopener noreferrer" class="${linkClass}" style="text-decoration: underline;">${label}</a>`,
	);
}

export function getFlag(
	flags: Record<string, boolean> | undefined,
	key: string,
	defaultValue = false,
) {
	return flags?.[key] ?? defaultValue;
}

export async function injectVerificationBanner() {
	const DISMISS_CACHE_KEY = "verificationBannerDismissed";
	const cacheStorage = await cache.getValue();
	if (cacheStorage[DISMISS_CACHE_KEY]) return;

	const config = await getConfig();

	if (
		!config.apiAvailability.extension ||
		!getFlag(config.flags, "apis.isExtensionApiStable", true)
	) {
		console.warn(
			"[Kiln] Extension API is disabled or not yet stable, rejecting verification banner..",
		);
		return;
	}

	const mainContent = document.querySelector(
		'#main-content div[style^="min-height"]',
	)!;
	const banner = document.createElement("div");
	banner.classList.add(
		"alert",
		"alert-warning",
		"d-flex",
		"align-items-center",
		"gap-3",
		"p-3",
		"rounded-0",
		"border-0",
		"text-dark",
	);
	banner.style =
		"background-image: repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.05) 10px, rgba(0,0,0,0.05) 20px);";
	banner.style.margin = "0";
	banner.role = "alert";

	banner.innerHTML = `
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="bi bi-exclamation-triangle-fill flex-shrink-0" viewBox="0 0 16 16">
    <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5m.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2"></path>
  </svg>
  If you'd like to unlock additional Kiln features, please <a id="kiln-extension-verify-btn" href="#" class="text-secondary" style="text-decoration: underline;">verify your account</a>! It will only take a moment
  `;

	const dismissBtn = document.createElement("button");
	dismissBtn.type = "button";
	dismissBtn.className = "btn-close ms-auto";
	dismissBtn.setAttribute("aria-label", "Dismiss");
	dismissBtn.addEventListener("click", async () => {
		const cacheStorage = await cache.getValue();
		const metadata = (await cache.getMeta()) as { [key: string]: number };
		cacheStorage[DISMISS_CACHE_KEY] = "dismissed";
		metadata[DISMISS_CACHE_KEY] = Date.now();
		await cache.setValue(cacheStorage);
		await cache.setMeta(metadata);
		banner.remove();
	});
	banner.append(dismissBtn);

	mainContent.prepend(banner);

	const verifyBtn = document.getElementById("kiln-extension-verify-btn")!;
	verifyBtn.addEventListener("click", () => openVerificationModal());
}

function isNewerVersion(latest: string, current: string): boolean {
	const parse = (v: string) => v.split(".").map(Number);
	const [lMaj, lMin, lPat] = parse(latest);
	const [cMaj, cMin, cPat] = parse(current);
	if (lMaj !== cMaj) return lMaj > cMaj;
	if (lMin !== cMin) return lMin > cMin;
	return lPat > cPat;
}

export async function injectUpdateBanner() {
	const config = await getConfig();
	const latest = config.latestVersion;
	if (!latest) return;

	const current = browser.runtime.getManifest().version;
	if (!isNewerVersion(latest, current)) return;

	const noticeId = `update-v${latest}`;
	const dismissed = await dismissedNotices.getValue();
	if (dismissed.includes("update-notices-disabled")) return;
	if (dismissed.includes(noticeId)) return;

	const mainContent = document.querySelector(
		'#main-content div[style^="min-height"]',
	);
	if (!mainContent) return;

	const banner = document.createElement("div");
	banner.classList.add(
		"alert",
		"alert-info",
		"d-flex",
		"align-items-center",
		"gap-2",
		"p-3",
		"rounded-0",
		"border-0",
		"text-dark",
	);
	banner.style.cssText =
		"background-image: repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.05) 10px, rgba(0,0,0,0.05) 20px); margin: 0;";
	banner.role = "alert";
	banner.innerHTML = `<i class="fa-solid fa-circle-arrow-up"></i><span><b>Kiln ${latest} is available!</b> Check for updates in your browser's extension manager.</span>`;

	const dismissBtn = document.createElement("button");
	dismissBtn.type = "button";
	dismissBtn.className = "btn-close ms-auto";
	dismissBtn.setAttribute("aria-label", "Dismiss");
	dismissBtn.addEventListener("click", async () => {
		const current = await dismissedNotices.getValue();
		if (!current.includes(noticeId)) {
			await dismissedNotices.setValue([...current, noticeId]);
		}
		banner.remove();
	});
	banner.append(dismissBtn);

	mainContent.prepend(banner);
}

export async function injectPostUpdateBanner() {
	const current = browser.runtime.getManifest().version;
	const seenId = `seen-v${current}`;

	const dismissed = await dismissedNotices.getValue();
	if (dismissed.includes("post-update-notices-disabled")) return;

	const hasPriorSeenEntry = dismissed.some((id) => id.startsWith("seen-v"));

	if (!hasPriorSeenEntry) {
		await dismissedNotices.setValue([...dismissed, seenId]);
		return;
	}

	if (dismissed.includes(seenId)) return;

	const mainContent = document.querySelector(
		'#main-content div[style^="min-height"]',
	);
	if (!mainContent) return;

	const banner = document.createElement("div");
	banner.classList.add(
		"alert",
		"alert-info",
		"d-flex",
		"align-items-center",
		"gap-2",
		"p-3",
		"rounded-0",
		"border-0",
		"text-dark",
	);
	banner.style.cssText =
		"background-image: repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.05) 10px, rgba(0,0,0,0.05) 20px); margin: 0;";
	banner.role = "alert";
	banner.innerHTML = `<i class="fa-solid fa-circle-check"></i><span>Kiln has updated to <b>v${current}</b>! Check out the <a href="/my/settings/kiln?tab=changelog" class="alert-link">changelog</a>.</span>`;

	const dismissBtn = document.createElement("button");
	dismissBtn.type = "button";
	dismissBtn.className = "btn-close ms-auto";
	dismissBtn.setAttribute("aria-label", "Dismiss");
	dismissBtn.addEventListener("click", async () => {
		const d = await dismissedNotices.getValue();
		if (!d.includes(seenId)) {
			await dismissedNotices.setValue([...d, seenId]);
		}
		banner.remove();
	});
	banner.append(dismissBtn);

	mainContent.prepend(banner);
}

export async function injectNoticeBanners() {
	const config = await getConfig();
	if (!config.notices?.length) return;

	const dismissed = await dismissedNotices.getValue();
	const mainContent = document.querySelector(
		'#main-content div[style^="min-height"]',
	);
	if (!mainContent) return;

	for (const notice of config.notices) {
		if (dismissed.includes(notice.id)) continue;

		const alertClass =
			notice.type === "warning" ? "alert-warning" : "alert-info";
		const banner = document.createElement("div");
		banner.classList.add(
			"alert",
			alertClass,
			"d-flex",
			"align-items-center",
			"gap-2",
			"p-3",
			"rounded-0",
			"border-0",
			"text-dark",
		);
		banner.style.cssText =
			"background-image: repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.05) 10px, rgba(0,0,0,0.05) 20px); margin: 0;";
		banner.role = "alert";

		const icon =
			notice.type === "warning"
				? `<i class="fa-solid fa-triangle-exclamation"></i>`
				: `<i class="fa-solid fa-circle-info"></i>`;

		const renderedMessage = renderMarkdownLinks(notice.message);

		banner.innerHTML = `${icon}<span>${renderedMessage}</span>`;

		const dismissBtn = document.createElement("button");
		dismissBtn.type = "button";
		dismissBtn.className = "btn-close ms-auto";
		dismissBtn.setAttribute("aria-label", "Dismiss");
		dismissBtn.addEventListener("click", async () => {
			const current = await dismissedNotices.getValue();
			if (!current.includes(notice.id)) {
				await dismissedNotices.setValue([...current, notice.id]);
			}
			banner.remove();
		});
		banner.append(dismissBtn);

		mainContent.prepend(banner);
	}
}

export function createModal(size: "sm" | "lg" = "sm"): HTMLDialogElement {
	const modal = document.createElement("dialog");
	modal.classList.add("kiln-extension-modal");
	if (size === "lg") modal.classList.add("kiln-modal--lg");
	document.body.prepend(modal);
	return modal;
}

export function openVerificationModal() {
	window.open(
		"https://polytoria.com/my/settings/kiln?tab=sync",
		"_blank",
		"noopener,noreferrer",
	);
}

export async function migrateLegacySettings(): Promise<boolean> {
	const legacyEnabledMap: Record<string, string> = {
		PinnedGamesOn: "favoritedPlaces",
		ForumMentsOn: "forumMentions",
		BestFriendsOn: "bestFriends",
		ImprovedFrListsOn: "improvedFriendLists",
		IRLPriceWithCurrencyOn: "irlBrickPrice",
		StoreOwnTagOn: "storeOwnedTags",
		TryOnItemsOn: "tryItems",
		OutfitCostOn: "outfitCost",
		ShowPlaceRevenueOn: "placeRevenue",
		HoardersListOn: "hoardersList",
		AvatarDimensionToggleOn: "avatarSandbox",
		MoreBlockedDetailsOn: "basicBlockedInfo",
	};

	const legacyCurrencyMap: Partial<Record<number, CurrencyCode>> = {
		0: "USD",
		1: "EUR",
		2: "CAD",
		3: "GBP",
		4: "MXN",
		5: "AUD",
		6: "TRY",
		7: "BRL",
	};

	if (typeof browser === "undefined" || !browser.storage?.sync) return false;

	const result = await browser.storage.sync.get("PolyPlus_Settings");
	const legacy = result?.PolyPlus_Settings as Record<string, any>;

	if (!legacy || typeof legacy !== "object") return false;

	const current = await preferences.getPreferences();
	const enabledSet = new Set(current.enabled);

	for (const [oldKey, featureId] of Object.entries(legacyEnabledMap)) {
		if (oldKey in legacy) {
			if (legacy[oldKey]) {
				//@ts-expect-error
				enabledSet.add(featureId);
			} else {
				//@ts-expect-error
				enabledSet.delete(featureId);
			}
		}
	}

	if (legacy.TheGreatDivide && typeof legacy.TheGreatDivide === "object") {
		if (legacy.TheGreatDivide.UserStatsOn) {
			enabledSet.add("tgdStats");
		} else {
			enabledSet.delete("tgdStats");
		}
	}

	const config = { ...current.config };

	if (typeof legacy.IRLPriceWithCurrencyCurrency === "number") {
		const mapped = legacyCurrencyMap[legacy.IRLPriceWithCurrencyCurrency];
		if (mapped) {
			config.irlBrickPrice = { currency: mapped };
		}
	}

	if (legacy.HoardersList && typeof legacy.HoardersList === "object") {
		config.hoardersList = {
			minCopies:
				legacy.HoardersList.MinCopies ??
				defaultPreferences.config.hoardersList.minCopies,
			showAvatars:
				legacy.HoardersList.AvatarsEnabled ??
				defaultPreferences.config.hoardersList.showAvatars,
		};
	}

	if (
		legacy.ImprovedPlaceManagement &&
		typeof legacy.ImprovedPlaceManagement === "object"
	) {
		config.placeManagement = {
			download:
				legacy.ImprovedPlaceManagement.PlaceFileDownloadOn ??
				defaultPreferences.config.placeManagement.download,
			bulkWhitelist:
				legacy.ImprovedPlaceManagement.MultiWhitelistOn ??
				defaultPreferences.config.placeManagement.bulkWhitelist,
			/*
			clearWhitelist:
				legacy.ImprovedPlaceManagement.ClearWhitelistOn ??
				defaultPreferences.config.placeManagement.clearWhitelist,
				*/
		};
	}

	if (
		legacy.ApplyMembershipTheme &&
		typeof legacy.ApplyMembershipTheme === "object"
	) {
		config.membershipThemes = {
			themeId: legacy.ApplyMembershipTheme.Theme === 1 ? "plusdx" : "plus",
		};
	}

	await preferences.setValue({
		enabled: [...enabledSet],
		config,
		disabled: [],
	});
	await browser.storage.sync.remove("PolyPlus_Settings");

	return true;
}

/*
  Cache
*/
export async function pullCache(
	key: string,
	replenish: () => Promise<any>,
	expiry: number,
	forceReplenish: boolean,
) {
	const cacheStorage: CacheInterface = await cache.getValue();
	const metadata = (await cache.getMeta()) as { [key: string]: number };

	const overlap = Date.now() - (metadata[key] || 0);
	const shouldReplenish =
		!cacheStorage[key] ||
		cacheStorage[key] == "unavailable" ||
		!metadata[key] ||
		forceReplenish ||
		(expiry !== -1 && overlap >= expiry);

	if (shouldReplenish) {
		if (import.meta.env.MODE == "development") {
			console.info(
				`[Kiln] "${key}" cache ${
					expiry === -1 ? "doesn't exist" : "is stale"
				} replenishing...`,
				expiry !== -1 ? timeAgo(overlap) : "",
			);

			if (forceReplenish) {
				console.warn(`FORCE REPLENSIHING CACHE!! ${key}`);
			}
		}

		const replenishedCache = await replenish();
		if (replenishedCache !== "unavailable") {
			cacheStorage[key] = replenishedCache;
			metadata[key] = Date.now();
			await cache.setValue(cacheStorage);
			await cache.setMeta(metadata);
		} else {
			return "unavailable";
		}
	}

	return cacheStorage[key];
}

export async function pullKVCache(
	store: string,
	key: string,
	replenish: () => Promise<any>,
	expiry: number,
	forceReplenish: boolean,
) {
	const cacheStorage: CacheInterface = await cache.getValue();
	const metadata = (await cache.getMeta()) as {
		[key: string]: Record<string, number>;
	};

	if (!cacheStorage[store]) cacheStorage[store] = {};
	if (!metadata[store]) metadata[store] = {};

	const overlap = Date.now() - (metadata[store][key] || 0);
	const shouldReplenish =
		!cacheStorage[store][key] ||
		cacheStorage[store][key] == "unavailable" ||
		forceReplenish ||
		(expiry !== -1 && overlap >= expiry);

	if (shouldReplenish) {
		if (import.meta.env.MODE == "development") {
			console.info(
				`[Kiln] ${store}:"${key}" KV cache ${
					expiry === -1 ? "doesn't exist" : "is stale"
				} replenishing...`,
				expiry !== -1 ? timeAgo(overlap) : "",
			);
		}

		const replenishedCache = await replenish();
		if (replenishedCache !== "unavailable") {
			const freshStorage = await cache.getValue();
			const freshMeta = (await cache.getMeta()) as {
				[key: string]: Record<string, number>;
			};
			if (!freshStorage[store]) freshStorage[store] = {};
			if (!freshMeta[store]) freshMeta[store] = {};
			freshStorage[store][key] = replenishedCache;
			freshMeta[store][key] = Date.now();
			await cache.setValue(freshStorage);
			await cache.setMeta(freshMeta);
			return replenishedCache;
		} else {
			return "unavailable";
		}
	}

	return cacheStorage[store][key];
}

export async function pullBulkKVCache<T>(
	store: string,
	keys: string[],
	replenish: (missingKeys: string[]) => Promise<Record<string, T>>,
	expiry: number,
	forceReplenish: boolean,
): Promise<Record<string, T>> {
	const cacheStorage: CacheInterface = await cache.getValue();
	const metadata = (await cache.getMeta()) as {
		[key: string]: Record<string, number>;
	};
	if (!cacheStorage[store]) cacheStorage[store] = {};
	if (!metadata[store]) metadata[store] = {};

	const now = Date.now();
	const result: Record<string, T> = {};
	const missing: string[] = [];

	for (const key of keys) {
		const overlap = now - (metadata[store][key] || 0);
		const stale =
			cacheStorage[store][key] === undefined ||
			forceReplenish ||
			(expiry !== -1 && overlap >= expiry);

		if (stale) {
			missing.push(key);
		} else {
			result[key] = cacheStorage[store][key];
		}
	}

	if (missing.length > 0) {
		if (import.meta.env.MODE == "development") {
			console.info(
				`[Kiln] ${store}: bulk replenishing ${missing.length}/${keys.length} keys...`,
			);
		}

		const fetched = await replenish(missing);

		const freshStorage = await cache.getValue();
		const freshMeta = (await cache.getMeta()) as {
			[key: string]: Record<string, number>;
		};
		if (!freshStorage[store]) freshStorage[store] = {};
		if (!freshMeta[store]) freshMeta[store] = {};

		for (const [key, value] of Object.entries(fetched)) {
			freshStorage[store][key] = value;
			freshMeta[store][key] = now;
			result[key] = value;
		}

		await cache.setValue(freshStorage);
		await cache.setMeta(freshMeta);
	}

	return result;
}

export async function expireCache(key: string) {
	console.info(`[Kiln] Forcefully expiring "${key}" cache...`);

	const metadata = (await cache.getMeta()) as { [key: string]: number };
	metadata[key] = 0;
	cache.setMeta(metadata);
}

export async function expireKVCache(store: string, key: string) {
	console.info(`[Kiln] Forcefully expiring "${store}":"${key}" KV cache...`);

	const metadata = (await cache.getMeta()) as {
		[key: string]: Record<string, number>;
	};
	if (!metadata[store]) metadata[store] = {};
	metadata[store][key] = 0;
	cache.setMeta(metadata);
}

function timeAgo(overlap: number) {
	const units = [
		{ label: "day", value: 24 * 60 * 60 * 1000 },
		{ label: "hour", value: 60 * 60 * 1000 },
		{ label: "min", value: 60 * 1000 },
		{ label: "sec", value: 1000 },
	];

	for (const { label, value } of units) {
		const count = Math.floor(overlap / value);
		if (count > 0) {
			return `${count} ${label}${count > 1 ? "s" : ""} ago`;
		}
	}

	return "just now";
}

/*
  Polytoria
*/
export function getUserDetails(): Promise<UserDetails | null> {
	return new Promise((resolve) => {
		function tryResolve() {
			const profileLink = document.querySelector<HTMLLinkElement>(
				'.navbar a.text-reset[href^="/users/"]',
			);
			const brickBalance = document.querySelector(
				'.navbar [data-bs-html="true"]',
			);

			if (!profileLink || !brickBalance) return false;

			const title =
				brickBalance.getAttribute("data-bs-original-title") ??
				brickBalance.getAttribute("data-bs-title");
			const match = title?.match(/([\d,]+)\s*Bricks/);

			if (!match) return false;

			const userId = parseInt(profileLink.href.split("/")[4], 10);
			resolve({
				username: profileLink.innerText.trim(),
				userId,
				bricks: parseInt(match[1].replace(/,/g, ""), 10),
				//@ts-expect-error: TODO: look into type error
				getAvatar: async () => {
					const r = await sendMessage("getUserAvatar", userId);
					if (!r.ok) return "unavailable" as const;
					return r.data;
				},
			});
			return true;
		}

		if (tryResolve()) return;

		const observer = new MutationObserver(() => {
			if (tryResolve()) observer.disconnect();
		});

		const navbar =
			document.querySelector(".navbar") ?? document.documentElement;
		observer.observe(navbar, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ["data-bs-original-title", "data-bs-title"],
		});

		const giveUpIfLoggedOut = () => {
			if (!document.querySelector('.navbar a.text-reset[href^="/users/"]')) {
				observer.disconnect();
				resolve(null);
			}
		};
		if (document.readyState === "complete") {
			giveUpIfLoggedOut();
		} else {
			window.addEventListener("load", giveUpIfLoggedOut, { once: true });
		}
	});
}

export async function bricksToCurrency(
	bricks: number,
	currency: CurrencyCode,
): Promise<string | null> {
	if (Number.isNaN(bricks) || bricks == 0) return null;

	const liveData = await getCurrencyRates();
	const packages = staticMetadata.economy.currencyPackages.base.toSorted(
		(a, b) => b[1] - a[1],
	);

	let totalValue = 0;
	for (const [currencyValue, bricksValue] of packages) {
		while (bricks >= bricksValue) {
			bricks -= bricksValue;
			totalValue += currencyValue;
		}
	}

	if (bricks > 0) {
		const cheapestPackage = packages[packages.length - 1];
		const [currencyValue, bricksValue] = cheapestPackage;
		totalValue += bricks * (currencyValue / bricksValue);
	}

	if (currency !== "USD") {
		const rate = liveData.usd[currency.toLowerCase()];
		if (!rate) {
			console.warn(`[Kiln] Missing conversion from USD to ${currency}`);
			return null;
		}
		totalValue *= rate;
	}

	return `~${totalValue.toFixed(2)} ${currency}`;
}

function _parseBrickValue(el: Element | null): number {
	if (!el) return 0;
	return parseInt(el.textContent?.trim() ?? "0", 10) || 0;
}

function _parseTradeSide(card: Element): TradeSide {
	const username =
		card.querySelector(".card-header")?.textContent?.trim() ?? "";
	const cleanUsername = username.replace(/\s+gives\s*$/i, "").trim();

	const itemLinks = card.querySelectorAll<HTMLAnchorElement>(
		'.card-body a[href*="/store/"]',
	);
	const items: TradeItem[] = Array.from(itemLinks).map((a) => {
		const href = a.getAttribute("href") ?? "";
		const storeIdMatch = href.match(/\/store\/(?:items\/)?(\d+)/);
		const storeId = storeIdMatch ? parseInt(storeIdMatch[1], 10) : 0;

		const valDiv = a.querySelector(".trd-box-val");
		const spans = valDiv?.querySelectorAll("span") ?? [];

		const serialText = spans[0]?.textContent?.trim() ?? "";
		const serial = serialText.startsWith("#")
			? parseInt(serialText.slice(1), 10)
			: null;

		const brickValue = _parseBrickValue(spans[1] ?? null);

		const thumbnailUrl =
			a.querySelector<HTMLImageElement>("img")?.getAttribute("src") ?? "";

		return { storeId, serial, brickValue, thumbnailUrl };
	});

	const footer = card.querySelector(".card-footer");
	const footerSuccessSpans = footer?.querySelectorAll(".text-success") ?? [];

	const totalValue = _parseBrickValue(footerSuccessSpans[0] ?? null);

	const bricksAddedText =
		footerSuccessSpans.length >= 3
			? (footerSuccessSpans[1]?.textContent?.trim() ?? "0")
			: "0";
	const bricksAdded = parseInt(bricksAddedText.replace(/[^0-9]/g, ""), 10) || 0;

	const afterFeesText = footer?.querySelector("small")?.textContent ?? "0";
	const bricksAfterFees =
		parseInt(afterFeesText.replace(/[^0-9]/g, ""), 10) || 0;

	const netValue = _parseBrickValue(
		footerSuccessSpans[footerSuccessSpans.length - 1] ?? null,
	);

	return {
		username: cleanUsername,
		items,
		totalValue,
		bricksAdded,
		bricksAfterFees,
		netValue,
	};
}

function _parseTradeStatus(root: Element | Document): {
	status: TradeStatus;
	counterparty: string;
} {
	const h5Text =
		root
			.querySelector(".d-flex.justify-content-center h5")
			?.textContent?.trim() ?? "";
	const counterparty = h5Text.replace(/^.+\bwith\s+/i, "").trim();

	if (
		root.querySelector(
			"button[onclick='accept()'], button[onclick='decline()']",
		)
	) {
		return { status: "pending", counterparty };
	}

	const badge =
		root.querySelector(".col-auto .badge")?.textContent?.trim().toLowerCase() ??
		"";
	if (badge === "accepted") return { status: "accepted", counterparty };
	if (badge === "declined") return { status: "declined", counterparty };
	if (badge === "canceled") return { status: "canceled", counterparty };

	return { status: "pending", counterparty };
}

export function parseTrade(root: Element | Document): ParsedTrade {
	const cards = root.querySelectorAll(".card");
	if (cards.length < 2) {
		throw new Error(`Expected at least 2 trade cards, found ${cards.length}`);
	}

	const { status, counterparty } = _parseTradeStatus(root);

	return {
		status,
		counterparty,
		sides: [_parseTradeSide(cards[0]), _parseTradeSide(cards[1])],
	};
}

/*
	Other
*/
export function parseFormattedNumber(value: string): number {
	return Number(value.replace(/,/g, ""));
}