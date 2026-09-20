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
import * as create from "./create";
import * as search from "./search";
import * as view from "./view";

function composerFeatures(
	values: Awaited<ReturnType<typeof preferences.getPreferences>>,
	showDisclosures: boolean,
) {
	if (values.enabled.includes("forumMarkdownButtons"))
		create.forumMarkdownButtons(showDisclosures);
	if (values.enabled.includes("forumPostPreview"))
		create.forumPostPreview(
			values.config.forumPostPreview.autoShow,
			showDisclosures,
		);
	if (values.enabled.includes("forumCharacterCount"))
		create.forumCharacterCount(showDisclosures);
	if (values.enabled.includes("forumImageLibrary")) create.forumImageLibrary();
	if (values.enabled.includes("forumFilteredWordHighlight"))
		create.forumFilteredWordHighlight();
}

export default defineContentScript({
	matches: ["https://polytoria.com/forum", "https://polytoria.com/forum/*"],
	main() {
		Promise.all([
			preferences.getPreferences(),
			_showKilnDisclosures.getValue(),
		]).then(([values, showDisclosures]) => {
			const [_, _first, second, third] = window.location.pathname.split("/");

			if (second == "post") {
				if (import.meta.env.MODE == "development") {
					console.log("[Kiln] Running view page functions: ", view);
				}

				_viewedForumThreads.getValue().then((threads) => {
					_viewedForumThreads.setValue([...threads, +third]);
				});

				if (values.enabled.includes("forumMentions"))
					view.forumMentions(showDisclosures);
				if (values.enabled.includes("aiBotForumWarnings"))
					view.aiBotForumWarnings(showDisclosures);
				if (values.enabled.includes("copyPostContents"))
					view.copyPostContents();
				if (values.enabled.includes("bookmarkedThreads"))
					view.bookmarkedThreads(showDisclosures);
				if (values.enabled.includes("collectibleOwnerLabels"))
					view.forumUserLabels(
						values.config.collectibleOwnerLabels?.inactiveDays ?? 30,
						values.config.collectibleOwnerLabels?.ogYear ?? 2023,
						showDisclosures,
					);
				composerFeatures(values, showDisclosures);
				if (values.enabled.includes("forumImageLibrary"))
					view.forumImageStarring(showDisclosures);
			} else if (second == "new") {
				if (import.meta.env.MODE == "development") {
					console.log("[Kiln] Running create page functions: ", create);
				}

				composerFeatures(values, showDisclosures);
				if (values.enabled.includes("forumDrafts"))
					create.forumDrafts(
						showDisclosures,
						values.config.forumDrafts.autoRestore,
					);
			} else if (!second || second == "category") {
				if (values.enabled.includes("advancedForumSearch")) {
					_viewedForumThreads.getValue().then((threads) => {
						search.advancedForumSearch(threads, showDisclosures);
					});
				}
				if (values.enabled.includes("myPosts")) search.myPosts(showDisclosures);
				if (values.enabled.includes("bookmarkedThreads"))
					view.bookmarkedThreads(showDisclosures);
			}
		});
	},
});
