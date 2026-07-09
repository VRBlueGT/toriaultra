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
import * as discovery from "./discovery";
import * as manage from "./manage";
import * as view from "./view";

export default defineContentScript({
	matches: [
		"https://polytoria.com/places/*",
		"https://polytoria.com/create/place/*",
	],
	main() {
		preferences.getPreferences().then(async (values) => {
			const user = await getUserDetails();
			if (!user) {
				console.warn("[Kiln] Failure to get logged in user details.");
				return;
			}

			const [_, first, second] = window.location.pathname.split("/");

			if (!Number.isNaN(Number(second))) {
				if (import.meta.env.MODE == "development") {
					console.log("[Kiln] Running view page functions: ", view);
				}

				const creatorAnchor = document.querySelector<HTMLAnchorElement>(
					'.place-hero-content a:has([class^="userlink-"])',
				);
				const creatorId =
					creatorAnchor?.getAttribute("href")?.split("/")[2] ?? null;

				if (values.enabled.includes("legacyWorldViewLayout")) {
					view.legacyPlaceViewLayout();
				}
				if (values.enabled.includes("favoritedPlaces")) {
					view.favoritedPlaces(user.userId);
				}
				if (values.enabled.includes("placeRevenue")) {
					view.approxPlaceRevenue();
				}
				if (values.enabled.includes("playtimeTracking")) {
					view.playtimeTracking(user.userId);
				}
				if (values.enabled.includes("activeChallengesDisplay")) {
					view.activeChallenges();
				}
				if (values.enabled.includes("improvedAchievements")) {
					if (values.config.improvedAchievements.progressBar) {
						view.achievementsProgressBar();
					}
					if (values.config.improvedAchievements.opacity) {
						view.fadedUnearnedAchievements();
					}
					if (values.config.improvedAchievements.percentages) {
						view.achievementEarnedPercentages();
					}
				}
				if (values.enabled.includes("serverShareLinks")) {
					view.serverShareLinks();
				}
				if (values.enabled.includes("serverRefreshing")) {
					view.serverRefreshing(
						values.enabled.includes("serverShareLinks")
							? (serverList) => view.attachServerShareButtons(serverList)
							: undefined,
					);
				}

				if (
					values.enabled.includes("creatorCommentLabels") &&
					values.config.creatorCommentLabels.worlds &&
					creatorId
				) {
					view.creatorCommentLabels(creatorId);
				}

				if (values.enabled.includes("autoRefreshData")) {
					view.autoRefreshData(
						values.config.autoRefreshData.interval as "30s" | "1m" | "5m",
					);
				}
				if (values.enabled.includes("detailedPlaceReviews")) {
					view.detailedPlaceReviews(user.userId);
				}
				if (values.enabled.includes("placeConsumablesTab") && creatorId) {
					view.placeConsumablesTab(creatorId);
				}
				if (values.enabled.includes("favoritedPlaces")) {
					view.recordPlaceView();
				}
			} else if (first === "create") {
				if (import.meta.env.MODE == "development") {
					console.log("[Kiln] Running manage page functions: ", manage);
				}

				if (values.enabled.includes("placeManagement")) {
					if (
						(window.location.pathname.includes("about") ||
							window.location.pathname.split("/").length == 4) &&
						values.config.placeManagement.download
					) {
						manage.placeFileExport();
					}

					if (
						window.location.pathname.includes("access") &&
						values.config.placeManagement.bulkWhitelist
					) {
						manage.bulkWhitelist();
					}

					if (
						window.location.pathname.includes("stats") &&
						values.enabled.includes("worldTrends")
					) {
						manage.worldTrends();
					}
				}
			} else {
				if (import.meta.env.MODE == "development") {
					console.log("[Kiln] Running discovery page functions: ", discovery);
				}

				if (values.enabled.includes("subtleV2Labels")) {
					discovery.subtleV2Labels(values.config.subtleV2Labels.mode);
				}

				if (values.enabled.includes("randomPlace")) {
					discovery.randomPlace();
				}

				if (
					values.enabled.includes("disableInfiniteScrolling") &&
					values.config.disableInfiniteScrolling.places
				) {
					discovery.disableInfiniteScrolling();
				}
			}
		});
	},
});
