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

export async function audioPreviews() {
	const activeAudioElements = new Set<HTMLAudioElement>();

	const pauseAllAudio = (): void => {
		for (const audio of activeAudioElements) {
			audio.pause();
		}
		activeAudioElements.clear();
	};

	const getSelectedTab = (): string | null => {
		return (
			document
				.querySelector("#categories .active")
				?.getAttribute("data-category") || null
		);
	};

	const setButtonState = (
		button: HTMLButtonElement,
		state: "idle" | "loading" | "playing",
	): void => {
		switch (state) {
			case "idle":
				button.innerHTML = '<i class="fa-solid fa-play"></i>';
				button.className = "btn btn-primary btn-sm";
				break;
			case "loading":
				button.innerHTML =
					'<div class="spinner-border text-light" role="status" ' +
					'style="--bs-spinner-width: 15px; --bs-spinner-height: 15px; ' +
					'--bs-spinner-border-width: 2px; vertical-align: middle; text-align: center;">' +
					'<span class="sr-only">Loading...</span></div>';
				break;
			case "playing":
				button.innerHTML = '<i class="fa-duotone fa-solid fa-play-pause"></i>';
				button.className = "btn btn-warning btn-sm";
				break;
		}
	};

	const attachPlayButton = (assetCard: HTMLDivElement): void => {
		const link =
			assetCard.querySelector<HTMLAnchorElement>('a[href^="/store"]');
		if (!link) return;

		const assetId = link.getAttribute("href")?.split("/")[2];
		if (!assetId) return;

		const playButton = document.createElement("button");
		playButton.className = "btn btn-primary btn-sm";
		playButton.style.cssText =
			"position: absolute; bottom: 0; right: 0; margin: 5px; margin-bottom: 55px; z-index: 2000;";
		setButtonState(playButton, "idle");

		const anchor = assetCard.getElementsByTagName("a")[0];
		anchor.parentElement?.insertBefore(playButton, anchor);

		const firstChild = assetCard.children[0] as HTMLElement | undefined;
		if (firstChild) firstChild.style.position = "relative";

		let audioElement: HTMLAudioElement | null = null;
		let isPlaying = false;
		let isLoading = false;

		const onEnded = (): void => {
			isPlaying = false;
			setButtonState(playButton, "idle");
		};

		playButton.addEventListener("click", async () => {
			if (isLoading) return;

			if (isPlaying) {
				isPlaying = false;
				audioElement?.pause();
				setButtonState(playButton, "idle");
				return;
			}

			if (audioElement) {
				isPlaying = true;
				await audioElement.play();
				setButtonState(playButton, "playing");
				return;
			}

			isLoading = true;
			setButtonState(playButton, "loading");

			const url = await sendMessage("getAssetAudio", +assetId);
			if (!url.ok || !url.data.url) return;

			isLoading = false;

			if (!url) {
				playButton.remove();
				return;
			}

			audioElement = new Audio(url.data.url);
			activeAudioElements.add(audioElement);

			audioElement.addEventListener("ended", onEnded);
			audioElement.addEventListener(
				"canplaythrough",
				() => {
					isPlaying = true;
					audioElement?.play();
					setButtonState(playButton, "playing");
				},
				{ once: true },
			);
		});
	};

	const assetGrid = document.getElementById("assets");
	if (!assetGrid) return;

	const observer = new MutationObserver((records) => {
		const clearedAllAssets = records.some(
			(record) =>
				record.removedNodes.length > 0 && assetGrid.children.length === 0,
		);

		if (clearedAllAssets) {
			pauseAllAudio();
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
