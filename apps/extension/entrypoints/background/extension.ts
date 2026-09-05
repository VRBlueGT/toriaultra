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

import { Extension, Polytoria } from "@kiln/schemas";
import z from "zod";
import { onMessage } from "@/utils/messaging";
import {
	expireKVCache,
	getFlag,
	pullBulkKVCache,
	pullCache,
	pullKVCache,
} from "@/utils/utilities";
import { handle, safeFetch, withApi, withAuthSession } from "./shared";

onMessage("getRetroItems", ({ data: page = 1 }) =>
	handle(async () => {
		const config = await withApi("kiln_api", "extension");
		return safeFetch(
			`${config.resolvedUrls.extension}items/retro?page=${page}`,
			Extension.RetroItemsApi,
		);
	}),
);

onMessage("getEventForItem", ({ data: itemId }) =>
	handle(async () => {
		const config = await withApi("kiln_api", "extension");
		return pullKVCache(
			"eventForItem",
			String(itemId),
			() =>
				safeFetch(
					`${config.resolvedUrls.extension}events/by-item/${itemId}`,
					Extension.EventForItemApi,
				),
			24 * 60 * 60 * 1000,
			false,
		);
	}),
);

onMessage("getEvents", () =>
	handle(async () => {
		const config = await withApi("kiln_api", "extension");
		return pullCache(
			"eventsList",
			() =>
				safeFetch(
					`${config.resolvedUrls.extension}events`,
					Extension.EventsListApi,
				),
			24 * 60 * 60 * 1000,
			false,
		);
	}),
);

onMessage("getEventItems", ({ data: eventId }) =>
	handle(async () => {
		const config = await withApi("kiln_api", "extension");
		return pullKVCache(
			"eventItems",
			String(eventId),
			() =>
				safeFetch(
					`${config.resolvedUrls.extension}events/${eventId}/items`,
					Extension.EventItemsApi,
				),
			24 * 60 * 60 * 1000,
			false,
		);
	}),
);

onMessage("getGreatDivideStats", ({ data: userId }) =>
	handle(async () => {
		const config = await withApi("extension_api", "extension");
		return pullKVCache(
			"greatDivideStats",
			String(userId),
			() =>
				safeFetch(
					`${config.resolvedUrls.extension}events/tgd/${userId}`,
					Extension.GreatDivideStatsApi,
				),
			6 * 60 * 60 * 1000,
			false,
		);
	}),
);

onMessage("checkUserActivity", ({ data: { userIds, days } }) =>
	handle(async () => {
		const config = await withApi("kiln_api", "extension");
		return pullBulkKVCache(
			`userActivity_${days}`,
			userIds.map(String),
			async (missing) => {
				const response = await safeFetch(
					`${config.resolvedUrls.extension}activity`,
					z.object({
						data: z.record(
							z.string(),
							z.object({
								active: z.boolean(),
								registeredAt: z.string().nullable(),
							}),
						),
					}),
					{
						method: "POST",
						body: JSON.stringify({ userIds: missing.map(Number), days }),
					},
				);
				return response.data;
			},
			60 * 60 * 1000,
			false,
		);
	}),
);

onMessage("showSecurityKeyRenamePrompt", ({ data: { currentName } }) =>
	handle(async () => {
		const tabs = await browser.tabs.query({
			active: true,
			currentWindow: true,
		});
		if (!tabs[0]?.id) return null;

		const results = await browser.scripting.executeScript({
			target: { tabId: tabs[0].id },
			world: "MAIN",
			args: [currentName],
			func: async (currentName: string) => {
				// @ts-expect-error
				const { value, isConfirmed } = await window.Swal.fire({
					title: "Rename Security Key",
					input: "text",
					inputLabel: "New name",
					inputValue: currentName,
					inputPlaceholder: "Enter new name...",
					showCancelButton: true,
					confirmButtonText: "Save",
				});
				if (!isConfirmed || !value?.trim()) return null;
				const newName = value.trim();
				// @ts-expect-error
				window.Swal.fire({
					icon: "success",
					title: "Security key renamed!",
					text: newName,
					timer: 3000,
					timerProgressBar: true,
					showConfirmButton: false,
					toast: true,
					position: "bottom-end",
				});
				return newName;
			},
		});

		return (results[0]?.result as string | null) ?? null;
	}),
);

onMessage("showHomepageReorderModal", ({ data: { sections } }) =>
	handle(async () => {
		const tabs = await browser.tabs.query({
			active: true,
			currentWindow: true,
		});
		if (!tabs[0]?.id) return null;

		const results = await browser.scripting.executeScript({
			target: { tabId: tabs[0].id },
			world: "MAIN",
			args: [sections],
			func: async (
				sections: Array<{ id: string; label: string; locked?: boolean }>,
			) => {
				// @ts-expect-error
				const Swal = window.Swal;

				const { value } = await Swal.fire({
					title: "Reorder Homepage",
					html: '<div id="kiln-reorder-list" style="text-align: left;"></div>',
					showCancelButton: true,
					confirmButtonText: "Save",
					cancelButtonText: "Cancel",
					width: 500,
					didOpen: () => {
						const list = document.getElementById(
							"kiln-reorder-list",
						) as HTMLElement;

						// Animates `el` from `firstRect` to its current (post-mutation)
						// position using a FLIP transform, instead of the browser's
						// native (and visually janky) HTML5 drag-and-drop.
						const flip = (el: HTMLElement, firstRect: DOMRect) => {
							const lastRect = el.getBoundingClientRect();
							const dy = firstRect.top - lastRect.top;
							if (!dy) return;

							el.style.transition = "none";
							el.style.transform = `translateY(${dy}px)`;
							el.getBoundingClientRect();
							requestAnimationFrame(() => {
								el.style.transition = "transform 150ms ease";
								el.style.transform = "";
							});
						};

						let dragEl: HTMLElement | null = null;
						let placeholder: HTMLElement | null = null;
						let grabOffsetX = 0;
						let grabOffsetY = 0;

						const onPointerMove = (e: PointerEvent) => {
							if (!dragEl || !placeholder) return;
							dragEl.style.left = `${e.clientX - grabOffsetX}px`;
							dragEl.style.top = `${e.clientY - grabOffsetY}px`;

							const dragRect = dragEl.getBoundingClientRect();
							const dragMiddle = dragRect.top + dragRect.height / 2;
							const siblings = Array.from(list.children) as HTMLElement[];
							const placeholderIndex = siblings.indexOf(placeholder);

							for (let i = 0; i < siblings.length; i++) {
								const sib = siblings[i];
								if (sib === placeholder || sib.dataset.locked === "true")
									continue;

								const rect = sib.getBoundingClientRect();
								const middle = rect.top + rect.height / 2;

								if (i < placeholderIndex && dragMiddle < middle) {
									const first = sib.getBoundingClientRect();
									list.insertBefore(placeholder, sib);
									flip(sib, first);
									break;
								}
								if (i > placeholderIndex && dragMiddle > middle) {
									const first = sib.getBoundingClientRect();
									list.insertBefore(placeholder, sib.nextElementSibling);
									flip(sib, first);
									break;
								}
							}
						};

						const onPointerUp = () => {
							document.removeEventListener("pointermove", onPointerMove);
							document.removeEventListener("pointerup", onPointerUp);
							document.body.style.userSelect = "";
							if (!dragEl || !placeholder) return;

							const finalRect = placeholder.getBoundingClientRect();
							const finishedDragEl = dragEl;
							const finishedPlaceholder = placeholder;
							dragEl = null;
							placeholder = null;

							finishedDragEl.style.transition =
								"left 150ms ease, top 150ms ease, box-shadow 150ms ease";
							finishedDragEl.style.left = `${finalRect.left}px`;
							finishedDragEl.style.top = `${finalRect.top}px`;
							finishedDragEl.style.boxShadow = "none";

							const cleanup = () => {
								list.insertBefore(finishedDragEl, finishedPlaceholder);
								finishedPlaceholder.remove();
								finishedDragEl.style.cssText = "";
								finishedDragEl.classList.remove("kiln-reorder-dragging");
							};
							finishedDragEl.addEventListener("transitionend", cleanup, {
								once: true,
							});
							setTimeout(cleanup, 200);
						};

						const startDrag = (e: PointerEvent, row: HTMLElement) => {
							e.preventDefault();

							const rect = row.getBoundingClientRect();
							grabOffsetX = e.clientX - rect.left;
							grabOffsetY = e.clientY - rect.top;

							placeholder = document.createElement("div");
							placeholder.style.height = `${rect.height}px`;
							const cs = getComputedStyle(row);
							placeholder.style.marginTop = cs.marginTop;
							placeholder.style.marginBottom = cs.marginBottom;
							placeholder.style.border = "2px dashed rgba(255, 255, 255, 0.25)";
							placeholder.style.borderRadius = cs.borderRadius;
							placeholder.style.boxSizing = "border-box";
							list.insertBefore(placeholder, row);

							document.body.appendChild(row);
							Object.assign(row.style, {
								position: "fixed",
								zIndex: "100000",
								width: `${rect.width}px`,
								left: `${rect.left}px`,
								top: `${rect.top}px`,
								margin: "0",
								pointerEvents: "none",
								boxShadow: "0 10px 25px rgba(0, 0, 0, 0.4)",
							});
							row.classList.add("kiln-reorder-dragging");

							dragEl = row;
							document.body.style.userSelect = "none";
							document.addEventListener("pointermove", onPointerMove);
							document.addEventListener("pointerup", onPointerUp);
						};

						for (const section of sections) {
							const row = document.createElement("div");
							row.className =
								"d-flex align-items-center gap-2 mb-2 p-2 rounded bg-dark border border-secondary";
							if (section.locked) row.classList.add("opacity-50");
							row.dataset.id = section.id;
							if (section.locked) row.dataset.locked = "true";
							row.innerHTML = section.locked
								? `
								<i class="fas fa-lock text-muted" style="width: 1em;"></i>
								<span class="flex-grow-1">${section.label}</span>
								<button type="button" class="btn btn-sm btn-outline-secondary" disabled><i class="fas fa-chevron-up"></i></button>
								<button type="button" class="btn btn-sm btn-outline-secondary" disabled><i class="fas fa-chevron-down"></i></button>
							`
								: `
								<i class="fas fa-grip-vertical text-muted kiln-reorder-handle" style="cursor: grab; touch-action: none;"></i>
								<span class="flex-grow-1">${section.label}</span>
								<button type="button" class="btn btn-sm btn-outline-secondary" data-dir="up"><i class="fas fa-chevron-up"></i></button>
								<button type="button" class="btn btn-sm btn-outline-secondary" data-dir="down"><i class="fas fa-chevron-down"></i></button>
							`;
							list.appendChild(row);

							if (section.locked) continue;

							row
								.querySelector('[data-dir="up"]')!
								.addEventListener("click", () => {
									const prev = row.previousElementSibling as HTMLElement | null;
									if (!prev) return;
									const firstRow = row.getBoundingClientRect();
									const firstPrev = prev.getBoundingClientRect();
									list.insertBefore(row, prev);
									flip(row, firstRow);
									flip(prev, firstPrev);
								});
							row
								.querySelector('[data-dir="down"]')!
								.addEventListener("click", () => {
									const next = row.nextElementSibling as HTMLElement | null;
									if (!next || next.dataset.locked === "true") return;
									const firstRow = row.getBoundingClientRect();
									const firstNext = next.getBoundingClientRect();
									list.insertBefore(next, row);
									flip(row, firstRow);
									flip(next, firstNext);
								});

							row
								.querySelector<HTMLElement>(".kiln-reorder-handle")!
								.addEventListener("pointerdown", (e) => startDrag(e, row));
						}
					},
					preConfirm: () => {
						const list = document.getElementById(
							"kiln-reorder-list",
						) as HTMLElement;
						return Array.from(list.children).map(
							(el) => (el as HTMLElement).dataset.id as string,
						);
					},
				});

				return value ?? null;
			},
		});

		return (results[0]?.result as string[] | null) ?? null;
	}),
);

onMessage("searchUsersByActivity", ({ data: query }) =>
	handle(async () => {
		const config = await withApi("kiln_api", "extension");
		const response = await safeFetch(
			`${config.resolvedUrls.extension}activity/search?q=${encodeURIComponent(query)}`,
			Extension.ActivitySearchApi,
		);
		return response.data;
	}),
);

onMessage("getNFTItems", ({ data: userId }) =>
	handle(async () => {
		const config = await withApi("extension_api", "extension");
		return pullKVCache(
			"nftItems",
			String(userId),
			() =>
				safeFetch(
					`${config.resolvedUrls.extension}users/${userId}/nfts`,
					Extension.NFTItems,
				),
			6 * 60 * 60 * 1000,
			false,
		);
	}),
);

onMessage("markItemAsNFT", ({ data: { userId, itemId, serials } }) =>
	handle(async () => {
		const result = await withAuthSession(userId, (token, config) =>
			safeFetch(
				`${config.resolvedUrls.extension}items/${itemId}/nft`,
				z.object({ success: z.boolean() }),
				{
					method: "PUT",
					headers: {
						Authorization: `Bearer ${token}`,
						"x-kiln-version": browser.runtime.getManifest().version,
					},
					body: JSON.stringify({ serials }),
				},
			),
		);
		expireKVCache("nftItems", String(userId));
		return result;
	}),
);

onMessage("unmarkItemAsNFT", ({ data: { userId, itemId } }) =>
	handle(async () => {
		const result = await withAuthSession(userId, (token, config) =>
			safeFetch(
				`${config.resolvedUrls.extension}items/${itemId}/nft`,
				z.object({ success: z.boolean() }),
				{
					method: "DELETE",
					headers: {
						Authorization: `Bearer ${token}`,
						"x-kiln-version": browser.runtime.getManifest().version,
					},
				},
			),
		);
		expireKVCache("nftItems", String(userId));
		return result;
	}),
);

onMessage("getPinnedAchievements", ({ data: userId }) =>
	handle(async () => {
		const config = await withApi("kiln_api", "extension");
		return pullKVCache(
			"pinnedAchievements",
			String(userId),
			() =>
				safeFetch(
					`${config.resolvedUrls.extension}users/${userId}/pinned-achievements`,
					Extension.PinnedAchievementsApi,
				),
			5 * 60 * 1000,
			false,
		);
	}),
);

onMessage("pinAchievement", ({ data: { userId, achievementId } }) =>
	handle(async () => {
		const result = await withAuthSession(userId, (token, config) =>
			safeFetch(
				`${config.resolvedUrls.extension}users/${userId}/pinned-achievements/${achievementId}`,
				null,
				{
					method: "PUT",
					headers: {
						Authorization: `Bearer ${token}`,
						"x-kiln-version": browser.runtime.getManifest().version,
					},
				},
			),
		);
		expireKVCache("pinnedAchievements", String(userId));
		return result as null;
	}),
);

onMessage("unpinAchievement", ({ data: { userId, achievementId } }) =>
	handle(async () => {
		const result = await withAuthSession(userId, (token, config) =>
			safeFetch(
				`${config.resolvedUrls.extension}users/${userId}/pinned-achievements/${achievementId}`,
				null,
				{
					method: "DELETE",
					headers: {
						Authorization: `Bearer ${token}`,
						"x-kiln-version": browser.runtime.getManifest().version,
					},
				},
			),
		);
		expireKVCache("pinnedAchievements", String(userId));
		return result as null;
	}),
);

onMessage("getBlockedTraders", ({ data: userId }) =>
	handle(async () =>
		pullKVCache(
			"blockedTraders",
			String(userId),
			() =>
				withAuthSession(userId, (token, config) =>
					safeFetch(
						`${config.resolvedUrls.extension}users/${userId}/blocked-traders`,
						Extension.BlockedTraders,
						{
							headers: {
								Authorization: `Bearer ${token}`,
								"x-kiln-version": browser.runtime.getManifest().version,
							},
						},
					),
				),
			6 * 60 * 60 * 1000,
			false,
		),
	),
);

onMessage("blockTrader", ({ data: { userId, blockedUserId } }) =>
	handle(async () => {
		const result = await withAuthSession(userId, (token, config) =>
			safeFetch(
				`${config.resolvedUrls.extension}users/${userId}/blocked-traders/${blockedUserId}`,
				z.object({ success: z.boolean() }),
				{
					method: "PUT",
					headers: {
						Authorization: `Bearer ${token}`,
						"x-kiln-version": browser.runtime.getManifest().version,
					},
				},
			),
		);
		expireKVCache("blockedTraders", String(userId));
		return result;
	}),
);

onMessage("unblockTrader", ({ data: { userId, blockedUserId } }) =>
	handle(async () => {
		const result = await withAuthSession(userId, (token, config) =>
			safeFetch(
				`${config.resolvedUrls.extension}users/${userId}/blocked-traders/${blockedUserId}`,
				z.object({ success: z.boolean() }),
				{
					method: "DELETE",
					headers: {
						Authorization: `Bearer ${token}`,
						"x-kiln-version": browser.runtime.getManifest().version,
					},
				},
			),
		);
		expireKVCache("blockedTraders", String(userId));
		return result;
	}),
);

onMessage("resolveItemThumbnails", ({ data: hashes }) =>
	handle(async () => {
		const config = await withApi("extension_api", "extension");
		const data = await pullBulkKVCache<number | null>(
			"itemThumbnails",
			hashes,
			(missing) =>
				safeFetch(
					`${config.resolvedUrls.extension}items/resolve-thumbnails`,
					Extension.ItemThumbnailMap,
					{
						method: "POST",
						body: JSON.stringify({ hashes: missing }),
					},
				).then((r) => r.data),
			24 * 60 * 60 * 1000,
			false,
		);
		return { data };
	}),
);

onMessage("getFavoritedPlaces", ({ data: userId }) =>
	handle(async () => {
		const idsResult = await withAuthSession(userId, (token, config) =>
			safeFetch(
				`${config.resolvedUrls.extension}places/favorites`,
				Extension.FavoritedPlaceIdsApi,
				{
					headers: {
						Authorization: `Bearer ${token}`,
						"x-kiln-version": browser.runtime.getManifest().version,
					},
				},
			),
		);

		const publicConfig = await withApi("public_api", "public");
		const useProxy = getFlag(
			publicConfig.flags,
			"apis.usePublicApiProxy",
			false,
		);
		const placeIds = idsResult.data;

		if (!useProxy) {
			const res: Record<string, any> = {};
			for (const id of placeIds) {
				res[id] = await pullKVCache(
					"places",
					String(id),
					() =>
						safeFetch(
							`${publicConfig.resolvedUrls.public}places/${id}`,
							Polytoria.PlaceApiSchema,
						),
					5 * 60 * 1000,
					false,
				);
			}
			return Object.values(res);
		}

		return safeFetch(
			`${publicConfig.resolvedUrls.public}multiple-places?ids=${placeIds.join(",")}`,
			z.array(Polytoria.PlaceApiSchema),
		);
	}),
);

onMessage("favoritePlace", ({ data: { placeId, userId } }) =>
	handle(() =>
		withAuthSession(userId, async (token, config) => {
			await safeFetch(
				`${config.resolvedUrls.extension}places/favorites/${placeId}`,
				null,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${token}`,
						"x-kiln-version": browser.runtime.getManifest().version,
					},
				},
			);
			return null;
		}),
	),
);

onMessage("unfavoritePlace", ({ data: { placeId, userId } }) =>
	handle(() =>
		withAuthSession(userId, async (token, config) => {
			await safeFetch(
				`${config.resolvedUrls.extension}places/favorites/${placeId}`,
				null,
				{
					method: "DELETE",
					headers: {
						Authorization: `Bearer ${token}`,
						"x-kiln-version": browser.runtime.getManifest().version,
					},
				},
			);
			return null;
		}),
	),
);
