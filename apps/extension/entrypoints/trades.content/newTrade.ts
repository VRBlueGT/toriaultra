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

const userId = +window.location.pathname.split("/")[3];

export async function nftItems() {
	const nfts = await sendMessage("getNFTItems", userId);
	if (!nfts.ok) return;

	const getCardHash = (card: Element): string | null => {
		const img = card.querySelector("img") as HTMLImageElement | null;
		if (!img?.src.includes("cdn.polytoria.com")) return null;
		const filename = img.src.split("/").pop();
		return filename?.replace(".png", "") ?? null;
	};

	const nftMap = new Map<number, number[] | null>();
	for (const item of nfts.data.data) {
		nftMap.set(item.itemId, item.serials);
	}

	const hashToItemId = new Map<string, number>();

	async function resolveHashes(cards: Element[]): Promise<void> {
		const unresolved = [
			...new Set(
				cards
					.map(getCardHash)
					.filter((h): h is string => h !== null && !hashToItemId.has(h)),
			),
		];
		if (unresolved.length === 0) return;

		for (let i = 0; i < unresolved.length; i += 100) {
			const result = await sendMessage(
				"resolveItemThumbnails",
				unresolved.slice(i, i + 100),
			);
			if (!result.ok) continue;
			for (const [hash, itemId] of Object.entries(result.data.data)) {
				if (itemId !== null) hashToItemId.set(hash, itemId);
			}
		}
	}

	function isNFT(card: Element): boolean {
		const hash = getCardHash(card);
		if (!hash) return false;
		const itemId = hashToItemId.get(hash);
		if (itemId === undefined || !nftMap.has(itemId)) return false;

		const serials = nftMap.get(itemId) as number[] | null;
		if (serials === null) return true;

		const serialEl = card.querySelector(".trd-box-val span[style]");
		if (!serialEl) return false;
		const serial = +(serialEl.textContent?.trim().replace(/^#/, "") ?? "");
		return serials.includes(serial);
	}

	const NFT_STYLE = Object.assign(document.createElement("style"), {
		textContent: `
        .trd-box.is-nft {
            border-color: orange !important;
            filter: opacity(0.3);
            background: repeating-linear-gradient(
                45deg,
                orange,
                orange 10px,
                transparent 10px,
                transparent 20px
            ) !important;
            pointer-events: none;
            position: relative;
        }
        .nft-overlay {
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #000;
            font-weight: 700;
            font-size: 1.5rem;
            text-align: center;
            pointer-events: none;
        }
    `,
	});
	document.head.appendChild(NFT_STYLE);

	function markCard(card: Element) {
		if (isNFT(card)) {
			card.classList.add("is-nft");
			if (!card.querySelector(".nft-overlay")) {
				const overlay = document.createElement("div");
				overlay.className = "nft-overlay";
				overlay.textContent = "Not for Trade";
				card.appendChild(overlay);
			}
		} else {
			card.classList.remove("is-nft");
			card.querySelector(".nft-overlay")?.remove();
		}
	}

	await new Promise<void>((resolve) => {
		if (document.querySelector("#other-items .trd-box")) {
			resolve();
			return;
		}
		const observer = new MutationObserver(() => {
			if (document.querySelector("#other-items .trd-box")) {
				observer.disconnect();
				resolve();
			}
		});
		observer.observe(document.body, { childList: true, subtree: true });
	});

	const otherItemsContainer = document.getElementById("other-items");
	if (!otherItemsContainer) return;

	const cards = [...otherItemsContainer.querySelectorAll<Element>(".trd-box")];
	await resolveHashes(cards);
	cards.forEach(markCard);
}
