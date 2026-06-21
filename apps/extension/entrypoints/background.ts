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

import { Extension, Polytoria } from "@kiln/schemas";
import { onMessage } from "@/utils/messaging";
import { cache, migrateThemesToLocal } from "@/utils/storage";
import {
	ApiDisabledError,
	ApiHttpError,
	fetchConfig,
	handle,
	NoSessionError,
	safeFetch,
	withApi,
	withAuthSession,
} from "./background/shared";

import "./background/config";
import "./background/users";
import "./background/items";
import "./background/places";
import "./background/trades";
import "./background/auth";
import "./background/extension";
import "./background/timePlayed";
import "./background/feedback";

export { ApiDisabledError, ApiHttpError, NoSessionError };

const MAX_CACHE_BYTES = 4 * 1024 * 1024; // 4 MB

const LINK_MENUS: { title: string; id: string; targetUrlPatterns: string[] }[] =
	[
		{
			title: "Copy Place ID",
			id: "Kiln-CopyPlaceID",
			targetUrlPatterns: ["https://polytoria.com/places/*"],
		},
		{
			title: "Copy User ID",
			id: "Kiln-CopyUserID",
			targetUrlPatterns: [
				"https://polytoria.com/users/*",
				"https://polytoria.com/u/*",
			],
		},
		{
			title: "Copy Item ID",
			id: "Kiln-CopyItemID",
			targetUrlPatterns: ["https://polytoria.com/store/*"],
		},
		{
			title: "Copy Guild ID",
			id: "Kiln-CopyGuildID",
			targetUrlPatterns: ["https://polytoria.com/guilds/*"],
		},
		{
			title: "Copy Thread ID",
			id: "Kiln-CopyThreadID",
			targetUrlPatterns: ["https://polytoria.com/forum/post/*"],
		},
	];

async function resolveIdFromUrl(linkUrl: string): Promise<string> {
	const parts = new URL(linkUrl).pathname.split("/");
	if (parts[1] === "u") {
		const config = await withApi("public_api", "public");
		const res = await safeFetch(
			`${config.resolvedUrls.public}users/find?username=${parts[2]}`,
			Polytoria.FindUserByUsernameApiSchema,
		);
		if ("id" in res) return String(res.id);
		throw new Error("Failed to resolve user");
	}
	return parts[2];
}

function extractAvatarHash(srcUrl: string): string {
	const pathname = new URL(srcUrl).pathname;
	return pathname.split("/")[3].replace("-icon", "").replace(".png", "");
}

async function copyToTab(tabId: number, value: string) {
	await browser.scripting.executeScript({
		target: { tabId },
		func: (v: string) => navigator.clipboard.writeText(v),
		args: [value],
	});
}

function setupContextMenus() {
	const docPatterns = ["https://polytoria.com/*"];

	browser.contextMenus.removeAll().then(() => {
		for (const menu of LINK_MENUS) {
			browser.contextMenus.create({
				title: menu.title,
				id: menu.id,
				contexts: ["link"],
				documentUrlPatterns: docPatterns,
				targetUrlPatterns: menu.targetUrlPatterns,
			});
		}

		browser.contextMenus.create({
			title: "Copy Avatar Hash",
			id: "Kiln-CopyAvatarHash",
			contexts: ["image"],
			documentUrlPatterns: docPatterns,
			targetUrlPatterns: [
				"https://c0.ptacdn.com/thumbnails/avatars/*",
				"https://cdn.polytoria.com/thumbnails/avatars/*",
			],
		});
	});

	browser.contextMenus.onClicked.addListener(async (info, tab) => {
		if (!tab?.id) return;

		const menuId = info.menuItemId as string;
		const tabId = tab.id;

		if (menuId === "Kiln-CopyThreadID") {
			const parts = new URL(info.linkUrl!).pathname.split("/");
			await copyToTab(tabId, parts[3]);
			return;
		}

		if (menuId === "Kiln-CopyAvatarHash") {
			await copyToTab(tabId, extractAvatarHash(info.srcUrl!));
			return;
		}

		const id = await resolveIdFromUrl(info.linkUrl!);
		await copyToTab(tabId, id);
	});
}

async function trimCacheIfNeeded() {
	const cacheValue = await cache.getValue();
	const bytes = new TextEncoder().encode(JSON.stringify(cacheValue)).byteLength;
	if (bytes > MAX_CACHE_BYTES) {
		console.log(
			`[Kiln] Cache is ${(bytes / (1024 * 1024)).toFixed(2)} MB, clearing...`,
		);
		await cache.setValue(cache.fallback);
	}
}

export default defineBackground(() => {
	console.log("Kiln background service worker is running!", {
		id: browser.runtime.id,
	});

	trimCacheIfNeeded();

	migrateThemesToLocal();

	migrateLegacySettings().then((migration) => {
		if (migration) {
			browser.tabs.create({
				url: "https://kiln.indexx.dev/rewrite",
				active: true,
			});
		}
	});

	setupContextMenus();

	let timePlayedInterval: ReturnType<typeof setInterval> | null = null;
	let timePlayedSession: {
		userId: number;
		sessionId: string;
		placeId: number;
	} | null = null;

	const stopTimePlayedSession = async (reason: string) => {
		if (timePlayedInterval) {
			clearInterval(timePlayedInterval);
			timePlayedInterval = null;
		}
		if (!timePlayedSession) return;
		const { sessionId } = timePlayedSession;
		const userId = timePlayedSession.userId;
		timePlayedSession = null;
		console.log(
			`[Kiln] Ending time played session. sessionId=${sessionId} reason=${reason}`,
		);
		const result = await handle(() =>
			withAuthSession(userId, (token, config) =>
				safeFetch(
					`${config.resolvedUrls.extension}places/play-sessions/${sessionId}/end`,
					Extension.PlaySessionApi,
					{
						method: "POST",
						headers: {
							Authorization: `Bearer ${token}`,
							"x-kiln-version": browser.runtime.getManifest().version,
						},
					},
				),
			),
		);
		if (result.ok) {
			const { verifiedMinutes, unverifiedMinutes } = result.data.data;
			console.log(
				`[Kiln] Session ended. sessionId=${sessionId} verified=${verifiedMinutes}m unverified=${unverifiedMinutes}m`,
			);
		} else {
			console.warn(
				`[Kiln] Failed to end session. sessionId=${sessionId} code=${result.code} message=${result.message}`,
			);
		}
	};

	browser.runtime.onConnect.addListener((port) => {
		if (port.name !== "kiln-time-played") return;

		console.log("[Kiln] Time played port connected.");

		port.onMessage.addListener(async (msg: any) => {
			if (timePlayedSession?.sessionId === msg.sessionId) {
				console.log(
					`[Kiln] Reconnected to existing session. sessionId=${msg.sessionId}`,
				);
				return;
			}

			if (timePlayedSession) {
				await stopTimePlayedSession("new-session");
			}

			timePlayedSession = msg;
			console.log(
				`[Kiln] Time played session started. userId=${msg.userId} sessionId=${msg.sessionId} placeId=${msg.placeId}`,
			);

			timePlayedInterval = setInterval(async () => {
				if (!timePlayedSession) return;
				const { userId, sessionId, placeId } = timePlayedSession;

				console.log(
					`[Kiln] Pinging time played session. sessionId=${sessionId}`,
				);

				const [pingResult, userResult] = await Promise.all([
					handle(() =>
						withAuthSession(userId, (token, config) =>
							safeFetch(
								`${config.resolvedUrls.extension}places/play-sessions/${sessionId}/ping`,
								Extension.PlaySessionApi,
								{
									method: "POST",
									headers: {
										Authorization: `Bearer ${token}`,
										"x-kiln-version": browser.runtime.getManifest().version,
									},
								},
							),
						),
					),
					handle(async () => {
						const config = await fetchConfig();
						return safeFetch(
							`${config.resolvedUrls.public}users/${userId}`,
							Polytoria.UserApiSchema,
						);
					}),
				]);

				if (!pingResult.ok) {
					console.warn(
						`[Kiln] Ping failed. sessionId=${sessionId} code=${pingResult.code} message=${pingResult.message}`,
					);
					await stopTimePlayedSession("ping-failed");
					return;
				}

				const { verifiedMinutes, unverifiedMinutes, pingCount } =
					pingResult.data.data;
				console.log(
					`[Kiln] Ping OK. sessionId=${sessionId} verified=${verifiedMinutes}m unverified=${unverifiedMinutes}m pings=${pingCount}`,
				);

				if (!userResult.ok) {
					console.warn(
						`[Kiln] Failed to fetch user status, skipping playing check. userId=${userId} code=${userResult.code}`,
					);
					return;
				}

				const playing = userResult.data.playing;
				if (playing?.placeID !== placeId) {
					console.log(
						`[Kiln] User is no longer in place. userId=${userId} expected=${placeId} actual=${playing?.placeID ?? "null"}`,
					);
					await stopTimePlayedSession("not-playing");
				}
			}, 60_000);
		});

		port.onDisconnect.addListener(() => {
			console.log(
				"[Kiln] Time played port disconnected. Session continues in background.",
			);
		});
	});
});

browser.runtime.onInstalled.addListener(async ({ reason }) => {
	const rules = [
		{
			id: 1,
			priority: 1,
			action: {
				type: "modifyHeaders",
				requestHeaders: [
					{
						header: "User-Agent",
						operation: "set",
						value: "UnityPlayer/",
					},
					{ header: "Sec-Ch-Ua", operation: "remove" },
					{ header: "Sec-Ch-Ua-Mobile", operation: "remove" },
					{ header: "Sec-Ch-Ua-Platform", operation: "remove" },
					{ header: "Sec-Fetch-Dest", operation: "remove" },
					{ header: "Sec-Fetch-Mode", operation: "remove" },
					{ header: "Sec-Fetch-Site", operation: "remove" },
				],
			},
			condition: {
				urlFilter: "||api.polytoria.com",
				resourceTypes: ["xmlhttprequest"],
			},
		},
	];

	try {
		await browser.declarativeNetRequest.updateDynamicRules({
			removeRuleIds: [1],
			addRules: rules as any,
		});
		console.log("UnityPlayer headers active.");
	} catch (err) {
		console.error("Failed to set rules:", err);
	}

	if (reason === "update" && import.meta.env.PROD) {
		await cache.setValue(cache.fallback);
		console.log("[Kiln] Cache cleared on update.");
	}

	if (reason == "install" && !import.meta.env.PROD) {
		browser.tabs.create({
			url: "https://kiln.indexx.dev/installed",
			active: true,
		});
	}
});

onMessage("openPreferences", () => {
	browser.tabs.create({ url: "https://polytoria.com/my/settings/kiln" });
});

onMessage("registerBootstrapElements", async () => {
	const tabs = await browser.tabs.query({ active: true, currentWindow: true });
	if (!tabs[0]) return;

	browser.scripting.executeScript({
		target: { tabId: tabs[0].id! },
		world: "MAIN",
		func: () => {
			//@ts-expect-error
			const bootstrap = window.bootstrap;
			[...document.querySelectorAll('[data-bs-toggle="tooltip"]')]
				.filter((el) => !bootstrap.Tooltip.getInstance(el))
				.map((el) => new bootstrap.Tooltip(el));
			[...document.querySelectorAll('[data-bs-toggle="dropdown"]')]
				.filter((el) => !bootstrap.Dropdown.getInstance(el))
				.map((el) => new bootstrap.Dropdown(el));
		},
	});
});