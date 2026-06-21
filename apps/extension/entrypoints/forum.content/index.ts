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
import * as view from "./view";

export default defineContentScript({
	matches: ["https://polytoria.com/forum/*"],
	main() {
		preferences.getPreferences().then((values) => {
			if (window.location.pathname.includes("post")) {
				if (import.meta.env.MODE == "development") {
					console.log("[Kiln] Running view page functions: ", view);
				}

				if (values.enabled.includes("forumMentions")) view.forumMentions();
				if (values.enabled.includes("aiBotForumWarnings"))
					view.aiBotForumWarnings();
			}
		});
	},
});