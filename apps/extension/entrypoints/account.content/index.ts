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
import * as avatar from "./avatar";
import * as friends from "./friends";
import * as settings from "./settings";
import * as transactions from "./transactions";

export default defineContentScript({
	matches: ["https://polytoria.com/my/*"],
	main() {
		preferences.getPreferences().then((values) => {
			getUserDetails().then((user) => {
				if (!user) {
					console.warn("[Kiln] Failure to get logged in user details.");
					return;
				}

				if (window.location.pathname.includes("settings")) {
					settings.injectKilnTab();
					if (window.location.pathname.includes("kiln-debug")) {
						settings.kilnDebug();
					} else if (window.location.pathname.includes("kiln")) {
						settings.kilnSettings();
					} else if (
						window.location.pathname.includes("transactions") &&
						values.enabled.includes("irlBrickPrice")
					) {
						transactions.irlBrickPrice(values.config.irlBrickPrice.currency);
					} else {
						settings.checkForVerificationCode(user.userId);
					}
				} else if (window.location.pathname.includes("friends")) {
					if (values.enabled.includes("improvedFriendLists")) {
						friends.actions();
					}
				} else if (window.location.pathname.includes("avatar")) {
					if (values.enabled.includes("avatarSandbox")) {
						if (new URLSearchParams(window.location.search).has("sandbox")) {
							document.title = "Kiln Character Sandbox";
							avatar.avatarSandbox();

							return;
						} else {
							const sandboxButton = document.createElement("a");
							sandboxButton.classList.value =
								"btn btn-outline-success w-100 mt-3";
							sandboxButton.href = "?sandbox=true";
							sandboxButton.innerHTML =
								'<i class="fas fa-shirt"></i> Kiln Character Sandbox';
							document
								.getElementById("cont-move")!
								.parentElement!.appendChild(sandboxButton);
						}
					}

					if (values.enabled.includes("customBodyColorHexCodes")) {
						avatar.customBodyColorHexCodes();
					}
				}
			});
		});
	},
});
