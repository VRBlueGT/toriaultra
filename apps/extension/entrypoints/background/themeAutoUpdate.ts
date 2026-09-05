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

import { Extension } from "@kiln/schemas";
import { sendMessage } from "@/utils/messaging";
import { _savedThemes, preferences } from "@/utils/storage";
import { safeFetch, withApi } from "./shared";

const ALARM_NAME = "kiln-theme-autoupdate";

export function scheduleThemeAutoUpdateCheck() {
	browser.alarms.create(ALARM_NAME, {
		delayInMinutes: 1,
		periodInMinutes: 24 * 60,
	});
}

browser.alarms.onAlarm.addListener((alarm) => {
	if (alarm.name === ALARM_NAME) checkForThemeUpdates();
});

async function notifyActiveThemeChanged() {
	const tabs = await browser.tabs.query({ url: "https://polytoria.com/*" });
	for (const tab of tabs) {
		if (tab.id === undefined) continue;
		sendMessage("themeAutoUpdated", undefined, tab.id).catch(() => {});
	}
}

export async function checkForThemeUpdates(): Promise<void> {
	const saved = await _savedThemes.getValue();
	const targets = saved.filter((t) => t.importedSlug && t.autoUpdate);
	if (targets.length === 0) return;

	const config = await withApi("kiln_api", "extension");
	const current = await _savedThemes.getValue();
	const values = await preferences.getPreferences();
	const activeId = values.enabled.includes("themeCreator")
		? (values.config.themeCreator.activeThemeId ?? "default")
		: null;

	let changed = false;
	let activeChanged = false;

	for (const t of targets) {
		let fetched: Extension.GetPublishedThemeApi["data"];
		try {
			const res = await safeFetch(
				`${config.resolvedUrls.extension}themes/${encodeURIComponent(t.importedSlug!)}`,
				Extension.GetPublishedThemeApi,
			);
			fetched = res.data;
		} catch {
			continue;
		}

		const idx = current.findIndex((x) => x.id === t.id);
		if (idx < 0) continue;
		const updatedEntry = {
			...current[idx],
			name: fetched.name,
			accentColor: fetched.accentColor,
			navbarColor: fetched.navbarColor,
			fontFamily: fetched.fontFamily ?? undefined,
			customCss: fetched.customCss ?? undefined,
			backgroundImage: fetched.backgroundImage ?? undefined,
			effects: fetched.effects?.length ? fetched.effects : undefined,
			navbarIconColor: fetched.navbarIconColor ?? undefined,
			cursorUrl: fetched.cursorUrl ?? undefined,
			colorTokens: fetched.colorTokens ?? undefined,
		};
		if (JSON.stringify(updatedEntry) !== JSON.stringify(current[idx])) {
			current[idx] = updatedEntry;
			changed = true;
			if (activeId === t.id) activeChanged = true;
		}
	}

	if (!changed) return;
	await _savedThemes.setValue(current);
	if (activeChanged) await notifyActiveThemeChanged();
}
