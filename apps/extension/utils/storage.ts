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

import type { WxtStorageItem } from "wxt/storage";
import preferencesList from "../public/preferences.json";
import type { FeatureId } from "./featureIds.generated";
import { sendMessage } from "./messaging";
import type {
	ApiSession,
	CacheInterface,
	EvalProfile,
	KilnErrorLogEntry,
	ThemeEffect,
} from "./types";

const prefItems = preferencesList.preferences;

export function isMobileDevice(): boolean {
	if ((navigator as any).userAgentData?.mobile) return true;
	return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function isChrome(): boolean {
	return (
		/Chrome/i.test(navigator.userAgent) && !/Edg|OPR/i.test(navigator.userAgent)
	);
}

const desktopOnlyIds = new Set(
	(prefItems as Array<{ id: string; desktopOnly?: boolean }>)
		.filter((p) => p.desktopOnly)
		.map((p) => p.id),
);

const chromeOnlyIds = new Set(
	(prefItems as Array<{ id: string; chromeOnly?: boolean }>)
		.filter((p) => p.chromeOnly)
		.map((p) => p.id),
);

const deprecatedHiddenIds = new Set(
	(prefItems as Array<{ id: string; hide?: boolean; defaultEnabled?: boolean }>)
		.filter((p) => p.hide && !p.defaultEnabled)
		.map((p) => p.id),
);

const irlBrickPriceCurrencies = new Set(
	(
		prefItems as Array<{
			id: string;
			config?: Array<{ options?: Array<{ value: string }> }>;
		}>
	).find((p) => p.id === "irlBrickPrice")?.config?.[0]?.options?.map((o) => o.value),
);

export const defaultPreferences = {
	enabled: (prefItems as Array<{ id: string; defaultEnabled?: boolean }>)
		.filter((p) => p.defaultEnabled)
		.map((p) => p.id) as FeatureId[],
	disabled: [] as FeatureId[],
	config: {
		...Object.fromEntries(
			(
				prefItems as Array<{
					id: string;
					config?: Array<{
						type: string;
						subsetting: string;
						default?: string | boolean;
					}>;
				}>
			)
				.filter((p) => p.config?.length)
				.map((p) => [
					p.id,
					Object.fromEntries(
						p.config!.map((c) => {
							if (c.type === "check") return [c.subsetting, c.default ?? true];
							const n = Number(c.default);
							return [c.subsetting, Number.isNaN(n) ? c.default : n];
						}),
					),
				]),
		),
		tradeEvaluation: {
			profile: "balanced" as EvalProfile,
		},
		themeCreator: {
			activeThemeId: "default" as string,
		},
	} as Record<string, Record<string, any>>,
};

export type preferencesSchema = typeof defaultPreferences & {
	[key: string]: any;
};

interface PreferencesStorageItem
	// biome-ignore lint/complexity/noBannedTypes: WXT
	extends WxtStorageItem<typeof defaultPreferences, {}> {
	getPreferences: () => Promise<typeof defaultPreferences>;
}

export const preferences: PreferencesStorageItem = storage.defineItem(
	"sync:preferences",
	{
		fallback: defaultPreferences,
		version: 5,
		migrations: {
			3: () => defaultPreferences,
			4: (oldValue: any) => ({
				...oldValue,
				disabled: defaultPreferences.enabled.filter(
					(id) => !((oldValue?.enabled as string[]) ?? []).includes(id),
				),
			}),
			5: (oldValue: any) => {
				const currency = oldValue?.config?.irlBrickPrice?.currency;
				if (currency === undefined || irlBrickPriceCurrencies.has(currency)) {
					return oldValue;
				}
				return {
					...oldValue,
					config: {
						...oldValue?.config,
						irlBrickPrice: {
							...oldValue?.config?.irlBrickPrice,
							currency: "USD",
						},
					},
				};
			},
		},
	},
) as PreferencesStorageItem;

export const _favoritedPlaces = storage.defineItem<number[]>(
	"sync:favoritedPlaces",
	{
		fallback: [],
		version: 1,
	},
);

export const _bestFriends = storage.defineItem("sync:bestFriends", {
	fallback: [],
	version: 1,
});

export const _lastViewedPlaces = storage.defineItem<Record<number, string>>(
	"local:lastViewedPlaces",
	{
		fallback: {},
		version: 1,
	},
);

export const _viewedForumThreads = storage.defineItem<number[]>(
	"local:viewedForumThreads",
	{
		fallback: [],
		version: 1,
	},
);

export interface KilnNotification {
	message: string;
	date: string;
	url: string;
	avatarUrl: string;
	read: boolean;
	dedupeValue: string;
}

export const _kilnNotifications = storage.defineItem<
	Record<string, KilnNotification>
>("local:kilnNotifications", {
	fallback: {},
	version: 1,
});

export type SavedTheme = {
	id: string;
	name: string;
	accentColor: string;
	navbarColor: string;
	fontFamily?: string;
	customCss?: string;
	publishedSlug?: string;
	previousPublishedSlug?: string;
	importedSlug?: string;
	backgroundImage?: string;
	backgroundOverlayColor?: string;
	backgroundOverlayOpacity?: number;
	effects?: ThemeEffect[];
	navbarIconColor?: string;
	cursorUrl?: string;
	cursorScale?: number;
	colorTokens?: Record<string, string>;
};

export const _savedThemes = storage.defineItem<SavedTheme[]>(
	"local:savedThemes",
	{
		fallback: [],
		version: 1,
	},
);

// Retained only for the one-time sync to local migration; do not use elsewhere.
const _savedThemesSync = storage.defineItem<SavedTheme[]>("sync:savedThemes", {
	fallback: [],
	version: 1,
});

export async function migrateThemesToLocal(): Promise<void> {
	const syncThemes = await _savedThemesSync.getValue();
	if (syncThemes.length === 0) return;

	const localThemes = await _savedThemes.getValue();
	if (localThemes.length === 0) {
		await _savedThemes.setValue(syncThemes);
	}
	await _savedThemesSync.removeValue();
}

export const _seenTradeIds = storage.defineItem<number[]>(
	"local:seenTradeIds",
	{
		fallback: [],
		version: 1,
	},
);

export const _viewedTradeIds = storage.defineItem<number[]>(
	"local:viewedTradeIds",
	{
		fallback: [],
		version: 1,
	},
);

export const _userAliases = storage.defineItem<Record<number, string>>(
	"local:userAliases",
	{
		fallback: {},
		version: 1,
	},
);

export const _userNotes = storage.defineItem<Record<number, string>>(
	"local:userNotes",
	{
		fallback: {},
		version: 1,
	},
);

preferences.getPreferences = async function () {
	const userPreferences = await this.getValue();

	const mergedEnabled = [
		...new Set([
			...defaultPreferences.enabled,
			...(userPreferences.enabled ?? []),
		]),
	].filter((id) => !(userPreferences.disabled ?? []).includes(id));

	const mergedConfig = {
		...defaultPreferences.config,
		...userPreferences.config,
		...Object.fromEntries(
			Object.keys(defaultPreferences.config).map((id) => [
				id,
				{
					...defaultPreferences.config[
						id as keyof typeof defaultPreferences.config
					],
					...(userPreferences.config?.[
						id as keyof typeof userPreferences.config
					] ?? {}),
				},
			]),
		),
	};

	const configResult = await sendMessage("getConfig").catch(() => null);
	const flags = configResult?.ok ? configResult.data.flags : {};
	const mobile = isMobileDevice();
	const chrome = isChrome();
	const activeEnabled = mergedEnabled.filter(
		(id) =>
			flags[`features.${id}.enabled`] !== false &&
			!(mobile && desktopOnlyIds.has(id)) &&
			!(!chrome && chromeOnlyIds.has(id)) &&
			!deprecatedHiddenIds.has(id),
	);

	return {
		...defaultPreferences,
		...userPreferences,
		enabled: activeEnabled,
		disabled: userPreferences.disabled ?? [],
		config: mergedConfig,
	};
};

export const cache = storage.defineItem<CacheInterface>("local:cache", {
	fallback: {
		remoteConfig: null as Record<string, any> | null,
		favoritedPlaces: {},
		bestFriends: {},
		inventory: {},
		users: {},
		userIDs: {},
		avatars: {},
		items: {},
		places: {},
		placeGamepasses: {},
		placeRevenue: {},
		ownerCount: {},
		greatDivideStats: {},
		lastDailyActiveUser: null as string | null,
		collectibles: {},
	},
	version: 2,
	migrations: {
		2: () => ({
			remoteConfig: null,
			favoritedPlaces: {},
			bestFriends: {},
			inventory: {},
			users: {},
			userIDs: {},
			avatars: {},
			items: {},
			places: {},
			placeGamepasses: {},
			placeRevenue: {},
			ownerCount: {},
			greatDivideStats: {},
			lastDailyActiveUser: null,
			collectibles: {},
		}),
	},
});

export const apiSessions = storage.defineItem<ApiSession[]>(
	"local:kilnSessions",
	{
		fallback: [],
		version: 1,
	},
);

export const dismissedNotices = storage.defineItem<string[]>(
	"local:dismissedNotices",
	{
		fallback: [],
		version: 1,
	},
);

export const _showKilnDisclosures = storage.defineItem<boolean>(
	"local:showKilnDisclosures",
	{
		fallback: false,
		version: 1,
	},
);

export interface BookmarkedThread {
	threadId: number;
	categoryId?: number;
	title: string;
	url: string;
	bookmarkedAt: string;
}

export const _bookmarkedThreads = storage.defineItem<
	Record<number, BookmarkedThread>
>("local:bookmarkedThreads", {
	fallback: {},
	version: 1,
});

export const _securityKeyNames = storage.defineItem<Record<number, string>>(
	"local:securityKeyNames",
	{
		fallback: {},
		version: 1,
	},
);

export const _errorLog = storage.defineItem<KilnErrorLogEntry[]>(
	"local:errorLog",
	{
		fallback: [],
		version: 1,
	},
);
