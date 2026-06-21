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

import type { Polytoria } from "@kiln/schemas";
import errorIcon from "@/assets/error.svg";
import sadFace from "@/assets/sad-face.webp";
import { _bestFriends, preferences } from "@/utils/storage";
import type { CurrencyCode } from "@/utils/types";
import { getUserDetails, openVerificationModal } from "@/utils/utilities";
import { sendMessage } from "../utils/messaging";

export default defineContentScript({
	matches: ["https://polytoria.com/", "https://polytoria.com/home"],
	main() {
		preferences.getPreferences().then((values) => {
			if (values.enabled.includes("favoritedPlaces")) favoritedPlaces();
			if (values.enabled.includes("bestFriends")) bestFriends();
			if (values.enabled.includes("irlBrickPrice"))
				irlBrickPrice(values.config.irlBrickPrice.currency as CurrencyCode);
			if (values.enabled.includes("homeFriendJoins")) homeJoinFriendsButton();

			if (values.enabled.includes("quickCreatorLaunchBtns"))
				quickCreatorLaunchBtns();
		});
	},
});

async function favoritedPlaces() {
	const container = document.createElement("div");
	container.innerHTML = `
      <div class="row reqFadeAnim px-2 px-lg-0">
        <div class="col">
          <h6 class="dash-ctitle2">Jump right back into your favorite worlds</h6>
          <h5 class="dash-ctitle">Pinned Worlds</h5>
        </div>
      </div>
      <div class="card card-dash mcard mb-3">
        <div class="card-body p-0 m-1 scrollFadeContainer">
          <div class="text-center p-5">
            <div class="spinner-border text-muted" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
          </div>
        </div>
      </div>
      `;

	const card: HTMLElement = container.getElementsByClassName(
		"scrollFadeContainer",
	)[0] as HTMLElement;
	const column = document.getElementsByClassName("col-lg-8")[0];

	if (
		document.getElementsByClassName("home-event-container")[0] === undefined
	) {
		column.insertBefore(container, column.children[0]);
	} else {
		column.insertBefore(container, column.children[1]);
	}

	const userDetails = await getUserDetails();
	if (!userDetails) {
		card.innerHTML = `
        <div class="text-center p-2">
          <img src="${errorIcon}" width="100" height="100">
          <p class="text-muted mb-0">Could not determine your user session. Try refreshing the page.</p>
        </div>
        `;
		return;
	}

	const favResult = await sendMessage("getFavoritedPlaces", userDetails.userId);
	const placeData: Array<Polytoria.PlaceApi> | "unavailable" = favResult.ok
		? favResult.data
		: "unavailable";
	const fetchError = !favResult.ok
		? favResult.code === "NO_SESSION"
			? "no_session"
			: "unavailable"
		: null;

	if (placeData == "unavailable") {
		if (fetchError === "no_session") {
			card.innerHTML = `
			<div class="text-center p-2">
				<img src="${errorIcon}" width="100" height="100">
				<p class="text-muted mb-2">Verify your account with Kiln to take advantage of Pinned Worlds!</p>
				<button class="btn btn-dark" id="kiln-pinned-verify-btn">Verify Account</button>
			</div>
        `;
			document
				.getElementById("kiln-pinned-verify-btn")
				?.addEventListener("click", () => {
					openVerificationModal();
				});
		} else {
			console.log(favResult);
			card.innerHTML = `
        <div class="text-center p-2">
          <img src="${errorIcon}" width="100" height="100">
          <p class="text-muted mb-0">Sorry! This feature is currently unavailable. Please check back later!</p>
        </div>
        `;
		}
		return;
	}

	if (placeData.length == 0) {
		card.innerHTML = `
        <div class="text-center p-2">
          <img class="m-2" src="${sadFace}" width="75" height="75" style="filter: grayscale(1)">
          <p class="text-muted mb-0">Looks like you don't have any pinned worlds yet! Go pin some!</p>
        </div>
        `;
		return;
	}

	const cardElements: Array<{
		scrollCard: HTMLAnchorElement;
		details: Polytoria.PlaceApi;
	}> = [];

	for (const details of placeData) {
		const scrollCard = document.createElement("a");
		scrollCard.classList.value = "d-none";
		scrollCard.href = `/places/${details.id}`;
		scrollCard.innerHTML = `
        <div class="scrollFade card me-2 place-card force-desktop text-center mb-2" style="opacity: 1;">
          <div class="card-body">
            <div class="ratings-header" style="position: relative;">
              <img src="${details.thumbnail}" class="place-card-image" style="position: relative;">
              <div class="p+pinned_games_playing" style="position: absolute;background: linear-gradient(to bottom, #000000f7, transparent, transparent, transparent);width: 100%;height: 100%;top: 0;left: 0;border-radius: 11px;padding-top: 12px;color: gray;font-size: 0.8rem;">
                <i class="fa-duotone fa-users"></i>
                <span>
                  ${details.playing}
                  Playing
                </span>
              </div>
            </div>
            <div>
              <div class="mt-2 mb-1 place-card-title">
                ${details.name}
              </div>
            </div>
          </div>
        </div>
        `;

		if (!details.isActive) {
			const PlayerCountText = scrollCard.getElementsByClassName(
				"p+pinned_games_playing",
			)[0];
			PlayerCountText.children[0].classList.value =
				"text-warning fa-duotone fa-lock";
			PlayerCountText.children[1].remove();
		}

		card.appendChild(scrollCard);
		cardElements.push({ scrollCard, details });
	}

	card.children[0].remove();
	card.classList.add("d-flex");
	Array.from(card.children).forEach((place) => {
		place.classList.remove("d-none");
	});

	await Promise.all(
		cardElements.map(async ({ scrollCard, details }) => {
			const creatorResult = await sendMessage("getUser", details.creator.id);
			if (creatorResult.ok) return;

			const ratingsHeader = scrollCard.querySelector(
				".ratings-header",
			) as HTMLElement | null;
			if (!ratingsHeader) return;

			const unfavoriteOverlay = document.createElement("div");
			unfavoriteOverlay.style.cssText = `
				position: absolute;
				inset: 0;
				border-radius: 11px;
				background: rgba(0, 0, 0, 0.72);
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				gap: 6px;
				z-index: 10;
				backdrop-filter: blur(2px);
			`;
			unfavoriteOverlay.innerHTML = `
				<i class="fa-duotone fa-circle-exclamation text-warning" style="font-size: 1.4rem;"></i>
				<p class="mb-1 text-white" style="font-size: 0.7rem; text-align: center; line-height: 1.3; padding: 0 8px;">World might be unavailable.</p>
				<button class="btn btn-sm btn-danger kiln-unpin-btn" style="font-size: 0.7rem; padding: 2px 10px;">Unpin</button>
			`;

			const unpinBtn = unfavoriteOverlay.querySelector(
				".kiln-unpin-btn",
			) as HTMLButtonElement;
			unpinBtn.addEventListener("click", async (e) => {
				e.preventDefault();
				e.stopPropagation();
				unpinBtn.disabled = true;
				unpinBtn.textContent = "Unpinning…";

				const result = await sendMessage("unfavoritePlace", {
					placeId: details.id,
					userId: userDetails.userId,
				});

				if (result.ok) {
					scrollCard.remove();

					if (card.querySelectorAll("a").length === 0) {
						card.classList.remove("d-flex");
						card.innerHTML = `
							<div class="text-center p-2">
								<img class="m-2" src="${sadFace}" width="75" height="75" style="filter: grayscale(1)">
								<p class="text-muted mb-0">Looks like you don't have any pinned worlds yet! Go pin some!</p>
							</div>
						`;
					}
				} else {
					unpinBtn.disabled = false;
					unpinBtn.textContent = "Unpin";
				}
			});

			ratingsHeader.appendChild(unfavoriteOverlay);
		}),
	);
}

function bestFriends() {
	const friendsRow = document.querySelector(
		".card:has(.friendsPopup) .d-flex",
	)!;

	const createHeadshot = async (id: string) => {
		const r = await sendMessage("getUser", +id);
		if (!r.ok) {
			throw new Error(
				"[Kiln] API is disabled, cancelling best friends loading..",
			);
		}
		const user = r.data;

		const headshot = document.createElement("div");

		headshot.classList.add("friend-circle");
		Object.assign(headshot.dataset, {
			userId: id,
			username: user.username,
			isOnline: "false",
			location: "offline",
		});

		headshot.innerHTML = `
    <img width="90" height="auto" src="${user.thumbnail.icon}" alt="${user.username}" class="img-fluid rounded-circle border border-2 ">
    <div class="friend-name text-truncate mt-1">
      <div style="font-size: 0.5rem; line-height: 0.5rem; display: inline-block;">
        <span class="text-muted">
          <i class="fas fa-dot-circle"></i>
        </span>
      </div>
      ${user.username}
    </div>
    `;

		friendsRow.prepend(headshot);
		return headshot;
	};

	_bestFriends.getValue().then(async (friends) => {
		if (friends.length == 0) return;

		for (const id of friends) {
			let headshot = document.getElementById(`friend-${id}`);
			if (!headshot) headshot = await createHeadshot(id).catch(() => null);
			if (headshot) friendsRow.prepend(headshot, friendsRow.children[0]);
		}
	});
}

async function irlBrickPrice(irlCurrency: CurrencyCode) {
	const trendingItems = Array.from(
		document.querySelectorAll('a[href^="/store"]:has(.place-card)'),
	);

	for (const item of trendingItems) {
		const priceTag = item.getElementsByClassName("text-success")[0];
		if (priceTag) {
			const currency = await bricksToCurrency(
				parseInt(priceTag.textContent!.replace(/,/g, ""), 10),
				irlCurrency,
			);

			if (currency) {
				const spanTag = document.createElement("span");
				spanTag.classList.add("text-muted");
				spanTag.style.fontSize = "0.7rem";
				spanTag.style.fontWeight = "lighter";
				spanTag.innerText = ` (${currency})`;
				priceTag.appendChild(spanTag);
			}
		}
	}
}

function homeJoinFriendsButton() {
	const friendsPopup = document.getElementById("friend-name")!;

	const observer = new MutationObserver((records) => {
		for (const record of records) {
			for (const node of record.addedNodes) {
				if (!(node instanceof HTMLAnchorElement)) continue;

				const joinButton = document.createElement("button");
				joinButton.className = "btn btn-success btn-sm";
				Object.assign(joinButton.style, {
					position: "absolute",
					top: 0,
					right: 0,
					zIndex: 2000,
					margin: "3px",
				});
				joinButton.innerHTML = '<i class="fas fa-play"></i>';
				node.parentElement?.parentElement?.appendChild(joinButton);

				joinButton.addEventListener("click", async () => {
					const profileLink = document.getElementById(
						"friendsProfileLink",
					) as HTMLAnchorElement | null;
					const userId = profileLink?.getAttribute("href")?.split("/")[2];

					if (!userId) {
						console.error(`[Kiln] Missing userId.`);
						return;
					}

					const userResult = await sendMessage("getUser", +userId);
					if (!userResult.ok) return;

					window.location.href = `https://polytoria.com/places/${userResult.data.playing!.placeID}?serverId=${userResult.data.playing!.serverID}`;
				});
			}
		}
	});

	observer.observe(friendsPopup, { childList: true, subtree: true });
}

function quickCreatorLaunchBtns() {
	const stickySection = document.querySelector(".dashboardAvatarShadow + *");

	const btnGroup = document.createElement("div");
	btnGroup.classList.add("btn-group", "w-100", "mb-3");

	const btn = document.createElement("button");
	btn.classList.add("btn", "btn-primary");
	btn.innerText = "Open 2.0 Creator";

	const btn2 = document.createElement("button");
	btn2.classList.add("btn", "btn-secondary");
	btn2.innerText = "Open 1.0 Creator";

	btnGroup.append(btn, btn2);
	stickySection?.prepend(btnGroup);

	btn.addEventListener("click", () => {
		console.log("aaa");
		sendMessage("openCreator", 2);
	});
	btn2.addEventListener("click", () => sendMessage("openCreator", 1));
}