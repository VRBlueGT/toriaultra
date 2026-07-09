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
import * as inventory from "./inventory";
import * as view from "./view";

export default defineContentScript({
	matches: [
		"https://polytoria.com/u/*",
		"https://polytoria.com/users",
		"https://polytoria.com/users/*",
	],
	main() {
		preferences.getPreferences().then(async (values) => {
			const segment = window.location.pathname.split("/")[2];
			const isLegacyUrl = window.location.pathname.split("/")[1] === "users";

			if (isLegacyUrl && (!segment || Number.isNaN(Number(segment)))) {
				if (values.enabled.includes("collectibleOwnerLabels")) {
					discovery.userLabels(
						values.config.userLabels?.inactiveDays ?? 30,
						values.config.userLabels?.ogYear ?? 2023,
					);
				}
				return;
			}

			let userId: number;
			if (isLegacyUrl) {
				userId = Number(segment);
			} else {
				const r = await sendMessage("findUserByUsername", segment);
				if (!r.ok) throw new Error(r.message);
				userId = r.data;
			}

			if (import.meta.env.MODE === "development") {
				console.log("[Kiln] Running view page functions: ", view);
			}

			if (
				window.location.pathname.includes("inventory") &&
				values.enabled.includes("inventoryCollectibles")
			) {
				const nav = document.getElementsByClassName("nav-pills")[0];
				const parts = window.location.pathname.split("/");
				const profileBase = `/${parts[1]}/${parts[2]}`;
				const collectibleNav = document.createElement("li");
				collectibleNav.classList.add("nav-item");
				collectibleNav.innerHTML = `
				<a href="${profileBase}/inventory/collectibles/" class="nav-link">
					<i class="fa-regular fa-sparkles me-1"></i>
					<span class="pilltitle">Collectibles</span>
				</a>
				`;
				nav.appendChild(collectibleNav);

				if (window.location.pathname.split("/")[4] === "collectibles") {
					Array.from(nav.children).forEach((element) => {
						element = element.children[0];
						if (!(element === collectibleNav)) {
							if (element.classList.contains("active")) {
								element.classList.remove("active");
							}
						}
					});
					collectibleNav.children[0].classList.add("active");

					const hoardedItemsCard = document.createElement("li");
					hoardedItemsCard.classList.add("nav-item", "text-center");
					hoardedItemsCard.innerHTML = `
					<h6 class="section-title mt-3 px-2">
						Hoarded Items
					</h6>
					<div class="card bg-dark mt-2">
						<div class="card-body" id="p+hoarded_card"></div>
					</div>
					`;
					nav.appendChild(hoardedItemsCard);

					inventory.collectibleInventoryCategory(userId);
				}
			} else {
				const blocked = document.querySelector(".card-body:has(.fa-ban)");

				if (!blocked) {
					if (values.enabled.includes("userIdDisplay")) view.displayId(userId);
					if (values.enabled.includes("collectibleOwnerLabels"))
						view.userLabels(
							userId,
							values.config.userLabels?.inactiveDays ?? 30,
							values.config.userLabels?.ogYear ?? 2023,
						);
					if (values.enabled.includes("outfitCost")) view.outfitCost(userId);
					if (values.enabled.includes("rankingPositions"))
						view.rankingPositions(userId);
					if (values.enabled.includes("tgdStats"))
						view.greatDivideStats(userId);
					if (values.enabled.includes("classicAvatarPerspective")) {
						document.getElementById("avatarToggleBtn")!.click();
					}
					if (values.enabled.includes("avatarVersions")) {
						view.avatarVersions(userId);
					}
					if (values.enabled.includes("pinnedAchievements")) {
						view.pinnedAchievements(userId);
					}
					if (values.enabled.includes("userAliases")) {
						_userAliases.getValue().then((aliases) => {
							view.userAliases(userId, aliases);
						});
					}
					if (values.enabled.includes("userCreationsTab")) {
						view.creationsTab(userId);
					}
					if (values.enabled.includes("userNotes")) {
						view.userNotes(userId);
					}
					if (values.enabled.includes("avatarMeshDownloader")) {
						view.avatarMeshDownloader(userId);
					}
				} else if (values.enabled.includes("basicBlockedInfo")) {
					blocked.appendChild(document.createElement("hr"));

					view.displayId(userId, true);
					view.basicBlockedInfo(userId);
				}
			}
		});
	},
});
