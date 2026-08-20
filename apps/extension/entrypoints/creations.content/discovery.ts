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

export async function audioPreviews(showDisclosures: boolean) {
	const activeAudio: { current: HTMLAudioElement | null } = { current: null };

	const getSelectedTab = (): string | null => {
		return (
			document
				.querySelector("#categories .active")
				?.getAttribute("data-category") || null
		);
	};

	const attachPlayButton = (assetCard: HTMLDivElement): void => {
		const link =
			assetCard.querySelector<HTMLAnchorElement>('a[href^="/store"]');
		if (!link) return;

		const assetId = link.getAttribute("href")?.split("/")[2];
		if (!assetId) return;

		const thumbnail = assetCard.querySelector("img");
		if (!thumbnail) return;

		const sizedWrapper = assetCard.firstElementChild as HTMLElement | null;
		const maxWidth = sizedWrapper
			? getComputedStyle(sizedWrapper).maxWidth
			: null;
		if (sizedWrapper && maxWidth && maxWidth !== "none") {
			sizedWrapper.style.width = maxWidth;
		}

		const playButton = createAudioPlayButton(+assetId, activeAudio);
		applyKilnDisclosureTitle(playButton, showDisclosures, "Audio preview");
		thumbnail.replaceWith(playButton);
	};

	const assetGrid = document.getElementById("assets");
	if (!assetGrid) return;

	const observer = new MutationObserver((records) => {
		const clearedAllAssets = records.some(
			(record) =>
				record.removedNodes.length > 0 && assetGrid.children.length === 0,
		);

		if (clearedAllAssets) {
			activeAudio.current?.pause();
			activeAudio.current = null;
		}

		if (getSelectedTab() !== "audio") return;

		for (const record of records) {
			for (const node of record.addedNodes) {
				if (node instanceof HTMLDivElement) {
					attachPlayButton(node);
				}
			}
		}
	});

	observer.observe(assetGrid, {
		attributes: false,
		childList: true,
		subtree: false,
	});
}
