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

export default defineContentScript({
	matches: ["https://polytoria.com/inbox"],
	main() {
		preferences.getPreferences().then((values) => {
			getUserDetails().then((user) => {
				if (!user) {
					console.warn("[Kiln] Failure to get logged in user details.");
					return;
				}

				if (values.enabled.includes("messagePreviewExpand")) {
					expandMessages();
				}
			});
		});
	},
});

function expandMessages() {
	const messages = document.getElementById("messages")!;
	for (const message of messages.children) {
		let expanded = false;
		let div: null | HTMLDivElement = null;

		const viewBtn = message.querySelector('a.btn[href^="/inbox/messages"]')!;
		const messageP = message.querySelector(
			"p.text-muted.text-truncate",
		)! as HTMLParagraphElement;
		const messageLink = messageP?.querySelector("a") as HTMLAnchorElement;

		if (!messageLink) continue;

		const fullText = messageLink.innerText;

		const expandBtn = document.createElement("button");
		expandBtn.classList = "btn btn-outline-warning px-4 mt-1";
		expandBtn.innerText = "Expand";
		viewBtn.parentElement!.appendChild(expandBtn);

		expandBtn.addEventListener("click", () => {
			if (div === null) {
				div = document.createElement("div");
				div.classList = "py-2";
				div.innerText = fullText;
				message.appendChild(div);
			}
			expanded = !expanded;
			expandBtn.innerText = expanded ? "Minimize" : "Expand";
			div.style.display = expanded ? "block" : "none";
		});
	}
}