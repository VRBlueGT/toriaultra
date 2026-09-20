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

import { _showKilnDisclosures, preferences } from "@/utils/storage";
import { getUserDetails } from "@/utils/utilities";
import * as discovery from "./discovery";
import * as view from "./view";

export default defineContentScript({
	matches: ["https://polytoria.com/store/*"],
	main() {
		Promise.all([
			preferences.getPreferences(),
			_showKilnDisclosures.getValue(),
		]).then(([values, showDisclosures]) => {
			getUserDetails().then(async (user) => {
				if (!user) {
					console.warn("[Kiln] Failure to get logged in user details.");
					return;
				}

				const pathSegments = window.location.pathname.split("/");

				if (
					pathSegments[2] === "create" &&
					["clothing", "shirt", "pants"].includes(pathSegments[3])
				) {
					if (values.enabled.includes("clothingUploadBodyPreviews")) {
						const { clothingCreateBodyPreview } = await import("./create");
						clothingCreateBodyPreview(showDisclosures);
					}
					return;
				}

				if (!window.location.pathname.split("/")[2]) {
					if (import.meta.env.MODE == "development") {
						console.log("[Kiln] Running discovery page functions: ", discovery);
					}

					const legacyDiscoveryLayout =
						values.enabled.includes("legacyItemViewLayout") &&
						values.config.legacyItemViewLayout.discovery;

					if (legacyDiscoveryLayout) {
						discovery.legacyStoreLayout(showDisclosures);
					}

					if (values.enabled.includes("irlBrickPrice")) {
						discovery.irlBrickPrice(
							values.config.irlBrickPrice.currency,
							showDisclosures,
						);
					}
					if (values.enabled.includes("storeOwnedTags")) {
						discovery.ownedTags(user.userId, showDisclosures);
					}
					if (values.enabled.includes("eventItems")) {
						discovery.eventItems(showDisclosures);
					}
					if (
						!legacyDiscoveryLayout &&
						values.enabled.includes("disableInfiniteScrolling") &&
						values.config.disableInfiniteScrolling.store
					) {
						discovery.disableInfiniteScrolling(showDisclosures);
					}
				} else {
					if (import.meta.env.MODE == "development") {
						console.log("[Kiln] Running view page functions: ", view);
					}

					const itemDetails = await sendMessage(
						"getItem",
						+window.location.pathname.split("/")[2],
					);
					if (!itemDetails.ok) return;

					if (values.enabled.includes("irlBrickPrice")) {
						view.irlBrickPrice(
							values.config.irlBrickPrice.currency,
							showDisclosures,
						);
					}
					if (values.enabled.includes("accurateOwners")) {
						view.accurateOwnerCount(showDisclosures);
					}
					if (values.enabled.includes("hoardersList")) {
						view.hoardersList(
							values.config.hoardersList?.minCopies ?? 2,
							values.config.hoardersList?.showAvatars ?? true,
							values.config.collectibleOwnerLabels?.inactiveDays ?? 30,
							values.enabled.includes("collectibleOwnerLabels"),
							values.config.collectibleOwnerLabels?.ogYear ?? 2023,
							showDisclosures,
						);
					}
					if (values.enabled.includes("mySerial")) {
						view.mySerial(user.userId, showDisclosures);
					}

					if (
						values.enabled.includes("nftItems") &&
						itemDetails.data.isLimited
					) {
						view.nftItems(user.userId, showDisclosures);
					}

					if (
						values.enabled.includes("nlfItems") &&
						itemDetails.data.isLimited
					) {
						view.nlfItems(user.userId, showDisclosures);
					}

					if (
						values.enabled.includes("itemOwnerCheck") &&
						itemDetails.data.isLimited
					) {
						view.ownerCheck(showDisclosures);
					}

					if (
						values.enabled.includes("loveIntegration") &&
						values.config.loveIntegration.itemView &&
						itemDetails.data.isLimited
					) {
						view.loveIntegration(showDisclosures);
					}

					if (
						values.enabled.includes("collectibleOwnerLabels") &&
						itemDetails.data.isLimited
					) {
						view.collectibleOwnerLabels(
							values.config.collectibleOwnerLabels?.inactiveDays ?? 30,
							values.config.collectibleOwnerLabels?.ogYear ?? 2023,
							showDisclosures,
						);
					}

					if (
						values.enabled.includes("backClothingView") &&
						["shirt", "pants", "clothing"].includes(itemDetails.data.type)
					) {
						view.clothing3DPreview(showDisclosures);
					}

					if (
						values.enabled.includes("creatorCommentLabels") &&
						values.config.creatorCommentLabels.items &&
						itemDetails.data.creator.type != "guild"
					) {
						view.creatorCommentLabels(
							itemDetails.data.creator.id,
							showDisclosures,
						);
					}

					if (itemDetails.data.type === "achievement") {
						view.pinnedAchievements(user.userId);
					}

					if (
						values.enabled.includes("legacyItemViewLayout") &&
						values.config.legacyItemViewLayout.itemView
					) {
						view.legacyStoreLayout(showDisclosures);
					}

					if (values.enabled.includes("recentCollectibleTransactions")) {
						view.recentTransactions(showDisclosures);
					}
				}
			});
		});
	},
});
