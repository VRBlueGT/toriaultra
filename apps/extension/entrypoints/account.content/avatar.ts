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

import sadFace from "@/assets/sad-face.webp";
import pageContent from "@/public/avatar-sandbox.html?raw";
import retroItemsData from "@/utils/static/retroItems.json";
import type { AvatarIFrameState, AvatarSandboxOutfit } from "@/utils/types";
import { createModal, getUserDetails } from "@/utils/utilities";
import { AvatarRenderer } from "./avatarRenderer";

interface CreatorInfo {
	name: string;
	id: number;
}

interface CachedItem {
	type: string;
	accessoryType?: string;
	name: string;
	price: number | null | false;
	creator: CreatorInfo | null;
	thumbnail: string;
	asset: string | undefined;
	ribbon?: string;
	isLimited?: boolean;
	createdAt?: string;
	id?: number;
}

interface StoreApiItem {
	type: string;
	name: string;
	price: number | null;
	creator: CreatorInfo;
	thumbnail: string;
	accessoryType?: string | null;
	isLimited?: boolean;
	createdAt?: string;
	sales?: number;
	id: number;
	path?: string;
	description?: string;
	tags?: string[];
	updatedAt?: string;
}

interface StoreApiResponse {
	assets: StoreApiItem[];
	pages: number;
	total?: number;
}

const DEFAULT_AVATAR: AvatarIFrameState = {
	useCharacter: true,
	items: [24122],
	clothing: [34910],
	face: 177726,
	headColor: "#e0e0e0",
	torsoColor: "#e0e0e0",
	leftArmColor: "#e0e0e0",
	rightArmColor: "#e0e0e0",
	leftLegColor: "#e0e0e0",
	rightLegColor: "#e0e0e0",
};

export function customBodyColorHexCodes() {
	const bodyPartButtons = document.querySelectorAll<HTMLButtonElement>(
		".avatarAction.bodypart",
	);

	bodyPartButtons.forEach((button) => {
		button.addEventListener("click", () => {
			const bodyPart = button.id;

			const modalObserver = new MutationObserver(() => {
				const swalContent = document.querySelector<HTMLElement>(
					".swal2-html-container, .swal2-content",
				);
				if (!swalContent) return;

				const customTab =
					swalContent.querySelector<HTMLElement>("#custom-color");
				if (!customTab || customTab.querySelector("#hex-code-input")) return;

				customTab.style.cssText = "display: block; text-align: center;";

				const wheelContainer =
					customTab.querySelector<HTMLElement>(".wheel-container");
				if (wheelContainer) {
					wheelContainer.style.cssText = "display: inline-block; margin: auto;";
				}

				const wrapper = document.createElement("div");
				wrapper.style.cssText = "margin-top: 12px; display: block;";

				const label = document.createElement("label");
				label.htmlFor = "hex-code-input";
				label.textContent = "Hex:";
				label.style.cssText = "font-weight: 600; font-size: 14px;";

				const input = document.createElement("input");
				input.type = "text";
				input.id = "hex-code-input";
				input.classList.add("form-control", "form-control-sm");
				input.placeholder = "#abcdef";
				input.maxLength = 7;

				const colorPicker = document.querySelector<HTMLInputElement>(
					'.swal2-container input[type="color"]',
				);
				if (colorPicker) {
					input.value = colorPicker.value;
					colorPicker.addEventListener("input", () => {
						input.value = colorPicker.value;
					});
				}

				const updateBtn = document.createElement("button");
				updateBtn.textContent = "Update";
				updateBtn.classList.add("btn", "btn-primary", "btn-sm");

				updateBtn.addEventListener("mousedown", async (e) => {
					e.preventDefault();
					e.stopPropagation();

					const color = input.value.trim();

					if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
						return;
					}

					// @ts-expect-error
					if (typeof Swal !== "undefined") Swal.close();

					await sendMessage("updateBodyColor", { bodyPart, color });

					window.location.reload();
				});

				wrapper.appendChild(label);
				wrapper.appendChild(input);
				wrapper.appendChild(updateBtn);
				customTab.appendChild(wrapper);
				modalObserver.disconnect();
			});

			modalObserver.observe(document.body, { childList: true, subtree: true });
		});
	});
}

/**
 * Adds a modified avatar editor page with all the items so you can create anything you want.
 * @param avatar The avatar to load as a default.
 */
export function avatarSandbox(
	avatar: AvatarIFrameState = { ...DEFAULT_AVATAR },
) {
	const container = document.querySelector(
		".container.p-0.p-lg-5",
	) as HTMLElement;

	const itemCache: Record<number | string, CachedItem> = {
		24122: {
			type: "hat",
			accessoryType: "hat",
			name: "Polytoria Cap",
			price: 0,
			creator: { name: "Polytoria", id: 1 },
			thumbnail:
				"https://cdn.polytoria.com/thumbnails/assets/RR0VPd5hX30Fx5APwRBGObotf1xD1DRT.png",
			asset:
				"https://cdn.polytoria.com/assets/Z8NbTA8HdRgGI3G6ZZec6yk5i1IK11f8.glb",
		},
		177726: {
			type: "face",
			name: "Classic Smirk",
			price: 0,
			creator: { name: "Polytoria", id: 1 },
			thumbnail:
				"https://cdn.polytoria.com/thumbnails/assets/1pAAH07VDGyypN66PdwP7glnFrVPPvwC.png",
			asset:
				"https://cdn.polytoria.com/assets/T2iRSGfF-USjCej5fq_-P1HNrNX8Grx4.png",
		},
		34910: {
			type: "clothes",
			name: "Treehugging",
			price: 0,
			creator: { name: "Polytoria", id: 1 },
			thumbnail:
				"https://cdn.polytoria.com/thumbnails/assets/xdlc4TPwiMaWhNZDwWe00ahhapazlyPs.png",
			asset:
				"https://cdn.polytoria.com/assets/auYuxLt30lqoNXhJjUz28Al5G7c1jYWs.png",
		},
	};

	let page = 1;
	let pageCount = 1;
	let search = "";
	let sort = "createdAt";
	let order = "desc";
	const showOffsale = true;
	let tabSelected = "hat";
	let retroItems: unknown[][] | null = null;
	let outfits: AvatarSandboxOutfit[] | null = null;
	let selectedBodyPart: string;
	let kilnUserId: number | null = null;
	let isVerified = false;
	const storeCache = new Map<
		string,
		{
			items: StoreApiItem[];
			nextApiPage: number;
			totalApiPages: number;
			total?: number;
		}
	>();

	container.innerHTML = pageContent;
	const viewCanvas = document.getElementById("viewCanvas") as HTMLCanvasElement;
	const renderer = new AvatarRenderer(viewCanvas);

	const bodyColorsModal = createModal();
	const colorSwatches = [
		"#f8f8f8",
		"#cdcdcd",
		"#111111",
		"#ff0000",
		"#a34b4b",
		"#ffc9c9",
		"#957977",
		"#c4281c",
		"#da867a",
		"#694028",
		"#cc8e69",
		"#a05f35",
		"#7c5c46",
		"#eab892",
		"#da8541",
		"#aa5500",
		"#ffcc99",
		"#e29b40",
		"#ffaf00",
		"#ffb000",
		"#d7c59a",
		"#f5cd30",
		"#fdea8d",
		"#e5e4df",
		"#c1be42",
		"#ffff00",
		"#ffffcc",
		"#a4bd47",
		"#7f8e64",
		"#a1c48c",
		"#3a7d15",
		"#4b974b",
		"#00ff00",
		"#ccffcc",
		"#27462d",
		"#287f47",
		"#789082",
		"#9ff3e9",
		"#12eed4",
		"#f2f3f3",
		"#00ffff",
		"#008f9c",
		"#04afec",
		"#80bbdb",
		"#b4d2e4",
		"#0d69ac",
		"#1b2a35",
		"#afddff",
		"#6e99ca",
		"#74869d",
		"#2154b9",
		"#002060",
		"#0000ff",
		"#b1a7ff",
		"#a3a2a5",
		"#6225d1",
		"#b480ff",
		"#8c5b9f",
		"#6b327c",
		"#aa00aa",
		"#635f62",
		"#ff00bf",
		"#ff66cc",
		"#e8bac8",
	]
		.map(
			(c) =>
				`<div class="colorpicker-color" style="background-color: ${c}"></div>`,
		)
		.join("");
	bodyColorsModal.innerHTML = `
<div class="row text-muted mb-4" style="font-size: 0.8rem;">
	<div class="col">
		<h5 class="mb-0" style="color: #fff;">Modify Body Colors</h5>
		Selected Body Part: <i id="p+selected_bodypart">none</i>
	</div>
	<div class="col-md-3">
		<button type="button" class="btn btn-info w-100 mx-auto">X</button>
	</div>
</div>
<div class="modal-body">
	<div class="wrapper">${colorSwatches}</div>
	<div class="input-group mt-2">
		<input type="text" class="form-control bg-dark" placeholder="HEX Code..">
		<button type="button" class="btn btn-primary">Set</button>
	</div>
</div>`;
	bodyColorsModal
		.querySelector<HTMLButtonElement>(".btn-info")!
		.addEventListener("click", () => bodyColorsModal.close());

	const outfitCreateModal = createModal();
	outfitCreateModal.innerHTML = `
<div class="row text-muted mb-4" style="font-size: 0.8rem;">
	<div class="col">
		<h5 class="mb-0" style="color: #fff;">Create Outfit</h5>
		Save this avatar for later!
	</div>
	<div class="col-md-2">
		<button type="button" class="btn btn-info w-100 mx-auto">X</button>
	</div>
</div>
<div class="modal-body">
	<div class="input-group mb-2">
		<input type="text" class="form-control" placeholder="Outfit Name...">
		<button type="button" class="btn btn-success">Save</button>
	</div>
	<b class="text-muted" style="font-size: 0.85rem;"><i class="fa-duotone fa-square-question mr-1"></i> ...</b>
</div>`;
	outfitCreateModal
		.querySelector<HTMLButtonElement>(".btn-info")!
		.addEventListener("click", () => outfitCreateModal.close());
	const outfitCreateButton =
		outfitCreateModal.querySelector<HTMLButtonElement>(".btn-success")!;
	const outfitCreateError = outfitCreateModal.querySelector<HTMLElement>("b")!;

	const outfitRenameModal = createModal();
	outfitRenameModal.innerHTML = `
<div class="row text-muted mb-4" style="font-size: 0.8rem;">
	<div class="col">
		<h5 class="mb-0" style="color: #fff;">Rename Outfit</h5>
		Renaming Outfit "<span class="kiln-rename-target">none</span>"
	</div>
	<div class="col-md-2">
		<button type="button" class="btn btn-info w-100 mx-auto">X</button>
	</div>
</div>
<div class="modal-body">
	<div class="input-group mb-2">
		<input type="text" class="form-control" placeholder="New Outfit Name...">
		<button type="button" class="btn btn-success">Save</button>
	</div>
	<b class="text-muted" style="font-size: 0.85rem;"><i class="fa-duotone fa-square-question mr-1"></i> ...</b>
</div>`;
	outfitRenameModal
		.querySelector<HTMLButtonElement>(".btn-info")!
		.addEventListener("click", () => outfitRenameModal.close());
	const outfitRenameButton =
		outfitRenameModal.querySelector<HTMLButtonElement>(".btn-success")!;
	const outfitRenameError = outfitRenameModal.querySelector<HTMLElement>("b")!;
	const outfitRenameNameEl = outfitRenameModal.querySelector<HTMLElement>(
		".kiln-rename-target",
	)!;

	let renameTargetIndex = -1;
	outfitRenameButton.addEventListener("click", () => {
		const renameInput =
			outfitRenameButton.previousElementSibling as HTMLInputElement;
		let outfitName = renameInput.value.trim();
		renameInput.value = "";

		if (outfitName === "") {
			outfitRenameError.className = "text-danger";
			outfitRenameError.innerHTML =
				'<i class="fa-duotone fa-circle-exclamation mr-1"></i> You cannot name an outfit nothing.';
			return;
		}

		if (outfitName.length > 25) outfitName = outfitName.substring(0, 25);

		if (outfits!.some((x) => x.name.trim() === outfitName)) {
			outfitRenameError.className = "text-danger";
			outfitRenameError.innerHTML = `<i class="fa-duotone fa-circle-exclamation mr-1"></i> You already have an outfit with the name "${outfitName}".`;
			return;
		}

		outfitRenameModal.close();
		outfits![renameTargetIndex].name = outfitName;
		if (tabSelected === "outfit") loadItems();
		persistOutfits();
	});

	function persistOutfits(): void {
		_avatarSandboxOutfits.setValue(outfits!);
		if (isVerified && kilnUserId !== null) {
			sendMessage("saveAvatarOutfits", {
				userId: kilnUserId,
				outfits: outfits!,
			});
		}
	}

	(async () => {
		const userDetails = await getUserDetails();
		if (!userDetails) return;
		kilnUserId = userDetails.userId;

		const sessionResult = await sendMessage("getApiSession", kilnUserId);
		if (!sessionResult.ok || sessionResult.data.data.state !== "verified") {
			return;
		}

		isVerified = true;

		const outfitsResult = await sendMessage("getAvatarOutfits", kilnUserId);
		if (!outfitsResult.ok) return;

		const apiOutfits = outfitsResult.data.data;
		const localOutfits = await _avatarSandboxOutfits.getValue();

		if (apiOutfits.length === 0 && localOutfits.length > 0) {
			outfits = localOutfits;
			sendMessage("saveAvatarOutfits", {
				userId: kilnUserId,
				outfits: localOutfits,
			});
		} else if (apiOutfits.length > 0) {
			outfits = apiOutfits;
			_avatarSandboxOutfits.setValue(apiOutfits);
			if (tabSelected === "outfit") loadItems();
		}
	})();

	updateAvatar();
	loadItems();

	const tabs = document.getElementById("tabs")!;
	Array.from(tabs.children).forEach((element) => {
		element.addEventListener("click", () => {
			const link = element.getElementsByTagName("a")[0];
			if (!link.classList.contains("active")) {
				link.classList.add("active");
				(
					tabs.querySelector(`[data-tab="${tabSelected}"]`) as HTMLElement
				).classList.remove("active");
				tabSelected = link.getAttribute("data-tab")!;
				(itemSearch.previousElementSibling as HTMLInputElement).value = "";
				page = 1;
				search = "";
				loadItems();
			}
		});
	});

	(
		Array.from(document.getElementsByClassName("bodypart")) as HTMLElement[]
	).forEach((part) => {
		part.addEventListener("click", () => {
			selectedBodyPart = part.id;
			bodyColorsModal.showModal();
		});
	});

	(
		Array.from(
			document.getElementsByClassName("colorpicker-color"),
		) as HTMLElement[]
	).forEach((color) => {
		color.addEventListener("click", () => {
			(avatar as Record<string, unknown>)[`${selectedBodyPart}Color`] =
				color.style.backgroundColor;
			bodyColorsModal.close();
			updateAvatar();
		});
	});

	const itemSearch = document.getElementById("search-btn") as HTMLButtonElement;
	itemSearch.addEventListener("click", () => {
		search = (itemSearch.previousElementSibling as HTMLInputElement).value;
		page = 1;
		loadItems();
	});

	const itemSort = document.getElementById("item-sort") as HTMLSelectElement;
	itemSort.addEventListener("change", () => {
		sort = itemSort.options[itemSort.selectedIndex].value;
		page = 1;
		loadItems();
	});

	const itemOrder = document.getElementById("item-order") as HTMLSelectElement;
	itemOrder.addEventListener("change", () => {
		order = itemOrder.options[itemOrder.selectedIndex].value;
		page = 1;
		loadItems();
	});

	const paginationFirst = document.getElementById("pagination-first")!;
	const paginationPrev = document.getElementById("pagination-prev")!;
	const paginationNext = document.getElementById("pagination-next")!;
	const paginationLast = document.getElementById("pagination-last")!;

	function updatePaginationState(): void {
		const atStart = page <= 1;
		const atEnd = page >= pageCount;
		paginationPrev.classList.toggle("disabled", atStart);
		paginationFirst.classList.toggle("disabled", atStart);
		paginationNext.classList.toggle("disabled", atEnd);
		paginationLast.classList.toggle("disabled", atEnd);
	}

	updatePaginationState();

	paginationFirst.addEventListener("click", () => {
		if (page > 1) {
			page = 1;
			loadItems();
		}
	});
	paginationPrev.addEventListener("click", () => {
		if (page > 1) {
			page--;
			loadItems();
		}
	});
	paginationNext.addEventListener("click", () => {
		if (page < pageCount) {
			page++;
			loadItems();
		}
	});
	paginationLast.addEventListener("click", () => {
		if (page < pageCount) {
			page = pageCount;
			loadItems();
		}
	});

	(document.getElementById("clear") as HTMLButtonElement).addEventListener(
		"click",
		() => {
			avatar = { ...DEFAULT_AVATAR };
			updateAvatar();
		},
	);

	(document.getElementById("myself") as HTMLButtonElement).addEventListener(
		"click",
		async () => {
			const userDetails = await getUserDetails();
			if (!userDetails) return;
			loadUser(userDetails.userId);
		},
	);

	const jsonUploadButton = document.getElementById(
		"jsonUpload",
	) as HTMLInputElement;
	jsonUploadButton.addEventListener("change", () => {
		const reader = new FileReader();
		reader.addEventListener("loadend", () => {
			avatar = JSON.parse(reader.result as string) as AvatarIFrameState;
			updateAvatar();
			jsonUploadButton.value = "";
		});
		reader.readAsText(jsonUploadButton.files![0]);
	});

	(document.getElementById("jsonSave") as HTMLButtonElement).addEventListener(
		"click",
		() => {
			const download = document.createElement("a");
			download.href = URL.createObjectURL(
				new Blob([JSON.stringify(avatar)], { type: "application/json" }),
			);
			download.setAttribute("download", "AvatarSandbox.json");
			document.body.appendChild(download);
			download.click();
			document.body.removeChild(download);
		},
	);

	(
		document.getElementById("viewFullscreen") as HTMLButtonElement
	).addEventListener("click", () => viewCanvas.requestFullscreen());

	const loadAsset = document.getElementById("load-asset") as HTMLButtonElement;
	const loadAssetType = document.getElementById(
		"load-asset-type",
	) as HTMLSelectElement;
	loadAsset.addEventListener("click", () => {
		const selectedType =
			loadAssetType.options[loadAssetType.selectedIndex].value;
		const inputEl = loadAsset.previousElementSibling as HTMLInputElement;

		if (inputEl.value === "trofie") inputEl.value = "31501";

		if (selectedType !== "user") {
			const parsedVal = Number.isNaN(Number(inputEl.value))
				? inputEl.value
				: parseInt(inputEl.value, 10);
			if (selectedType === "hat") {
				avatar.items.push(inputEl.value);
			} else if (selectedType === "clothing") {
				avatar.clothing ??= [];
				avatar.clothing.push(parsedVal);
			} else {
				(avatar as Record<string, unknown>)[selectedType] = parsedVal;
			}
			updateAvatar();
		} else {
			loadUser(inputEl.value);
		}

		inputEl.value = "";
	});

	(document.getElementById("saveOutfit") as HTMLButtonElement).addEventListener(
		"click",
		() => {
			if (!isVerified) {
				const outfitTab = tabs.querySelector<HTMLElement>(
					'[data-tab="outfit"]',
				)!;
				if (!outfitTab.classList.contains("active")) {
					outfitTab.classList.add("active");
					tabs
						.querySelector<HTMLElement>(`[data-tab="${tabSelected}"]`)!
						.classList.remove("active");
					tabSelected = "outfit";
					page = 1;
					search = "";
					loadItems();
				}
				return;
			}
			console.log(outfits);
			outfitCreateModal.showModal();
		},
	);

	outfitCreateButton.addEventListener("click", () => {
		const nameInput =
			outfitCreateButton.previousElementSibling as HTMLInputElement;
		let outfitName = nameInput.value.trim();
		nameInput.value = "";

		if (outfitName === "") {
			outfitCreateError.className = "text-danger";
			outfitCreateError.innerHTML =
				'<i class="fa-duotone fa-circle-exclamation mr-1"></i> You cannot name an outfit nothing.';
			return;
		}

		if (outfitName.length > 25) outfitName = outfitName.substring(0, 25);

		if ((outfits ?? []).some((x) => x.name.trim() === outfitName)) {
			outfitCreateError.className = "text-danger";
			outfitCreateError.innerHTML = `<i class="fa-duotone fa-circle-exclamation mr-1"></i> You already have an outfit with the name "${outfitName}".`;
			return;
		}

		outfitCreateModal.close();
		outfits ??= [];
		outfits.push({ name: outfitName, createdAt: Date.now(), data: avatar });
		if (tabSelected === "outfit") loadItems();
		persistOutfits();
	});

	document.getElementById("view-cache")!.addEventListener("click", () => {
		console.log("Cache: ", itemCache);
	});

	function initRetroItems(): void {
		const PAGE_SIZE = 12;
		const allItems: CachedItem[] = [];
		for (const [idStr, data] of Object.entries(retroItemsData)) {
			const numId = parseInt(idStr, 10);
			const negId = numId * -1;
			const item: CachedItem = {
				id: negId,
				type: data.type,
				accessoryType: data.accessoryType || undefined,
				name: data.name,
				price: data.price as number | null | false,
				creator: { id: 1, name: "Polytoria" },
				thumbnail: `https://poly-archive.pages.dev/assets/thumbnails/${numId}.png`,
				asset:
					(data as { asset?: string }).asset ??
					`https://poly-upd-archival.pages.dev/glb/${numId}.glb`,
				ribbon: "retro",
				createdAt: (data as { createdAt?: string }).createdAt,
			};
			itemCache[negId] = item;
			allItems.push(item);
		}
		const pages: CachedItem[][] = [];
		for (let i = 0; i < allItems.length; i += PAGE_SIZE) {
			pages.push(allItems.slice(i, i + PAGE_SIZE));
		}
		retroItems = pages as unknown[][];
	}

	async function updateAvatar(): Promise<void> {
		const formattedAvatar: AvatarIFrameState = structuredClone(avatar);

		if (retroItems === null && avatar.items.some((id) => (id as number) < 0)) {
			initRetroItems();
		}

		const accessoryPromise = [...avatar.items, avatar.tool, avatar.body]
			.filter(
				(x) =>
					x !== undefined &&
					!x.toString().startsWith("http") &&
					!x.toString().startsWith("data:"),
			)
			.map(async (x, index) => {
				const key = x as number | string;

				if (itemCache[key] === undefined) {
					const itemResult = await sendMessage("getItem", +key);
					if (itemResult.ok) {
						const itemDetails = itemResult.data;
						itemCache[key] = {
							type: itemDetails.type,
							name: itemDetails.name,
							price: itemDetails.price,
							creator: {
								name: itemDetails.creator.name,
								id: itemDetails.creator.id,
							},
							thumbnail: itemDetails.thumbnail,
							asset: undefined,
						};
						if (itemDetails.type === "hat") {
							//@ts-expect-error
							itemCache[key].accessoryType = itemDetails.accessoryType;
						}
					} else {
						itemCache[key] = {
							type: "unknown",
							name: `#${key}`,
							price: null,
							creator: null,
							thumbnail:
								"https://cdn.polytoria.com/static/images/broken.136e44ee.png",
							asset: undefined,
							ribbon: "unknown",
						};
					}

					if (["mesh", "decal", "audio"].includes(itemCache[key].type)) {
						itemCache[key].type =
							loadAssetType.options[loadAssetType.selectedIndex].value;
						itemCache[key].ribbon = "custom";
					}
				}

				if (itemCache[key].asset === undefined) {
					const meshResult = await sendMessage("getItemMesh", +key);
					if (meshResult.ok && meshResult.data.success)
						itemCache[key].asset = meshResult.data.url;
				}

				if (itemCache[key].asset !== undefined) {
					if (itemCache[key].type === "hat") {
						formattedAvatar.items[index] = itemCache[key].asset!;
					} else {
						(formattedAvatar as Record<string, unknown>)[itemCache[key].type] =
							itemCache[key].asset;
					}
				}
			});

		const loadTexture = async (x: number | string): Promise<void> => {
			const key = x as number | string;
			if (itemCache[key] === undefined) {
				const itemResult = await sendMessage("getItem", +key);
				if (itemResult.ok) {
					const itemDetails = itemResult.data;
					itemCache[key] = {
						type: itemDetails.type,
						name: itemDetails.name,
						price: itemDetails.price,
						creator: {
							name: itemDetails.creator.name,
							id: itemDetails.creator.id,
						},
						thumbnail: itemDetails.thumbnail,
						asset: undefined,
					};
					if (itemDetails.price === 0 && itemDetails.sales === 0) {
						itemCache[key].price = null;
					}
				} else {
					itemCache[key] = {
						type: "unknown",
						name: `#${key}`,
						price: null,
						creator: null,
						thumbnail:
							"https://cdn.polytoria.com/static/images/broken.136e44ee.png",
						asset: undefined,
						ribbon: "unknown",
					};
				}
				if (["mesh", "decal", "audio"].includes(itemCache[key].type)) {
					itemCache[key].ribbon = "custom";
				}
			}
			if (itemCache[key].asset === undefined) {
				const textureResult = await sendMessage("getItemTexture", +key);
				if (textureResult.ok && textureResult.data.success)
					itemCache[key].asset = textureResult.data.url;
			}
		};

		const facePromise =
			avatar.face !== undefined &&
			!avatar.face.toString().startsWith("http") &&
			!avatar.face.toString().startsWith("data:")
				? loadTexture(avatar.face).then(() => {
						if (itemCache[avatar.face!]?.asset !== undefined)
							formattedAvatar.face = itemCache[avatar.face!].asset;
					})
				: Promise.resolve();

		const clothingPromise = Promise.all(
			(avatar.clothing ?? [])
				.filter(
					(x) =>
						!x.toString().startsWith("http") &&
						!x.toString().startsWith("data:"),
				)
				.map(loadTexture),
		);

		formattedAvatar.face ??=
			"https://cdn.polytoria.com/static/3dview/DefaultFace.png";

		await Promise.all(accessoryPromise);
		await facePromise;
		await clothingPromise;

		formattedAvatar.clothing = (avatar.clothing ?? []).flatMap((x) => {
			if (x.toString().startsWith("http") || x.toString().startsWith("data:"))
				return [x as string];
			const asset = itemCache[x]?.asset;
			return asset !== undefined ? [asset] : [];
		});

		console.log("Real Avatar: ", avatar);
		console.log("Formatted: ", formattedAvatar);

		renderer.load(formattedAvatar);

		updateBodyColors();
		loadWearing();
	}

	async function loadUser(id: string | number): Promise<void> {
		const dataResult = await sendMessage("getUserAvatar", +id);
		if (!dataResult.ok) return;
		const data = dataResult.data;

		avatar = {
			useCharacter: true,
			items: [],
			headColor: `#${data.colors.head}` || "#cdcdcd",
			torsoColor: `#${data.colors.torso}` || "#cdcdcd",
			leftArmColor: `#${data.colors.leftArm}` || "#cdcdcd",
			rightArmColor: `#${data.colors.rightArm}` || "#cdcdcd",
			leftLegColor: `#${data.colors.leftLeg}` || "#cdcdcd",
			rightLegColor: `#${data.colors.rightLeg}` || "#cdcdcd",
		};

		data.assets.forEach(
			//@ts-expect-error: TODO
			(item: {
				id: number;
				type: string;
				accessoryType?: string;
				name: string;
				thumbnail: string;
				path?: string;
			}) => {
				if (itemCache[item.id] === undefined) {
					itemCache[item.id] = {
						type: item.type,
						name: item.name,
						price: null,
						creator: ["hat", "tool", "torso"].includes(item.type)
							? { id: 1, name: "Polytoria" }
							: null,
						thumbnail: item.thumbnail,
						asset: item.path,
					};
				}

				if (item.type === "hat") {
					itemCache[item.id].accessoryType = item.accessoryType;
					avatar.items.push(item.id);
				} else if (item.type === "clothing") {
					avatar.clothing ??= [];
					avatar.clothing.push(item.id);
				} else {
					(avatar as Record<string, unknown>)[item.type] = item.id;
				}
			},
		);

		updateAvatar();
	}

	async function loadItems(): Promise<void> {
		document.getElementById("inventory")!.innerHTML = "";

		const isRetro = tabSelected === "retro";
		for (const filter of Array.from(
			document.getElementsByClassName("retro-items-disable"),
		) as HTMLInputElement[]) {
			filter.disabled = isRetro;
			filter.classList.toggle("unavailable", isRetro);
		}


		let items: StoreApiResponse;

		if (!["retro", "outfit"].includes(tabSelected)) {
			const FETCH_LIMIT = 100;
			const DISPLAY_SIZE = 12;
			const cacheKey = `${tabSelected}|${search}|${sort}|${order}`;
			let cache = storeCache.get(cacheKey);

			if (!cache) {
				const result = await sendMessage("getStore", {
					order,
					sort,
					showOffsale,
					types: [tabSelected],
					search,
					page: 1,
					limit: FETCH_LIMIT,
				});
				if (!result.ok) return;
				//@ts-expect-error: To-fix
				const data: StoreApiResponse = result.data;
				cache = {
					items: data.assets ?? [],
					nextApiPage: 2,
					totalApiPages: data.pages,
					total: data.total,
				};
				storeCache.set(cacheKey, cache);
			}

			const cachedDisplayPages =
				Math.ceil(cache.items.length / DISPLAY_SIZE) || 1;
			if (
				page >= cachedDisplayPages &&
				cache.nextApiPage <= cache.totalApiPages
			) {
				const result = await sendMessage("getStore", {
					order,
					sort,
					showOffsale,
					types: [tabSelected],
					search,
					page: cache.nextApiPage,
					limit: FETCH_LIMIT,
				});
				if (result.ok) {
					//@ts-expect-error: To-fix
					const data: StoreApiResponse = result.data;
					cache.items.push(...(data.assets ?? []));
					cache.nextApiPage++;
					cache.totalApiPages = data.pages;
					cache.total ??= data.total;
				}
			}

			const start = (page - 1) * DISPLAY_SIZE;
			const hasMoreApiData = cache.nextApiPage <= cache.totalApiPages;
			items = {
				assets: cache.items.slice(
					start,
					start + DISPLAY_SIZE,
				) as unknown as StoreApiItem[],
				pages:
					cache.total !== undefined
						? Math.ceil(cache.total / DISPLAY_SIZE)
						: hasMoreApiData
							? Math.ceil(cache.items.length / DISPLAY_SIZE) + 1
							: Math.ceil(cache.items.length / DISPLAY_SIZE),
				total: cache.total,
			};
		} else if (tabSelected === "outfit") {
			pageCount = 1;
			updatePaginationState();
			document.getElementById("pagination-current")!.innerText = "1";
			const inv = document.getElementById("inventory")!;
			inv.classList.remove("itemgrid");
			inv.innerHTML = `
<div class="card mcard w-100">
  <div class="card-body text-center p-4">
    <img class="m-2" src="${sadFace}" width="75" height="75" style="filter: grayscale(1)">
    <p class="text-muted mb-0">Outfits are temporarily unavailable.</p>
  </div>
</div>`;
			return;
		} else {
			pageCount = 1;
			updatePaginationState();
			document.getElementById("pagination-current")!.innerText = "1";
			const inv = document.getElementById("inventory")!;
			inv.classList.remove("itemgrid");
			inv.innerHTML = `
<div class="card mcard w-100">
  <div class="card-body text-center p-4">
    <img class="m-2" src="${sadFace}" width="75" height="75" style="filter: grayscale(1)">
    <p class="text-muted mb-0">Retro items are temporarily unavailable.</p>
  </div>
</div>`;
			return;
		}

		pageCount = items.pages;
		updatePaginationState();
		document.getElementById("pagination-current")!.innerText = String(page);

		items.assets ??= [];

		const inventory = document.getElementById("inventory")!;

		if (items.assets.length > 0) {
			inventory.classList.add("itemgrid");

			if (tabSelected !== "outfit") {
				(items.assets as StoreApiItem[]).forEach((item) => {
					if (tabSelected !== "retro" && item.price === null) {
						(item as unknown as { price: false }).price = false;
					}

					const ribbon = chooseRibbon(item as unknown as CachedItem, false);

					const itemColumn = document.createElement("div");
					itemColumn.classList.value = "col-auto";
					itemColumn.innerHTML = `
<div style="max-width: 150px;">
  <div class="card mb-2 avatar-item-container">
    ${ribbon ?? ""}
    <div class="p-2">
      <img src="${item.thumbnail}" class="img-fluid" style="border-radius: 10px;">
      <button class="avatarAction btn btn-success btn-sm position-absolute rounded-circle text-center" style="top: -10px; right: -16px; width: 32px; height: 32px; z-index: 1;"><i class="fas fa-plus"></i></button>
    </div>
  </div>
  <a href="${item.id > 0 ? `/store/${item.id}` : `https://poly-archive.vercel.app/archive/${Math.abs(item.id)}`}" class="text-reset">
    <h6 class="text-truncate mb-0">${item.name}</h6>
  </a>
  <small class="text-muted d-block text-truncate">${formatTypeDisplay(item as unknown as CachedItem)}</small>
  <small style="font-size: 0.8rem;" class="d-block text-truncate mb-2 ${formatPrice(item.price as number | null | false)}
</div>`;
					inventory.appendChild(itemColumn);

					if (itemCache[item.id] === undefined && tabSelected !== "retro") {
						itemCache[item.id] = {
							type: item.type,
							name: item.name,
							price: item.price,
							creator: { name: item.creator.name, id: item.creator.id },
							thumbnail: item.thumbnail,
							asset: undefined,
							accessoryType:
								item.type === "hat"
									? (item.accessoryType ?? undefined)
									: undefined,
							ribbon: item.isLimited ? "limited" : undefined,
						};
					}

					itemColumn
						.getElementsByClassName("p-2")[0]
						.addEventListener("click", () => {
							wearAsset(item as unknown as CachedItem, item.id);
						});

					if (ribbon !== null) {
						itemColumn
							.getElementsByClassName("ribbon")[0]
							.addEventListener("click", () => {
								wearAsset(item as unknown as CachedItem, item.id);
							});
					}
				});
			} else {
				(items.assets as unknown as AvatarSandboxOutfit[]).forEach(
					(outfit, index) => {
						const colorBtn = (color: string, padding: string) =>
							`<button style="border:0;border-radius:5px;cursor:default;background-color:${color};padding:${padding};"></button>`;

						const itemColumn = document.createElement("div");
						itemColumn.classList.value = "col-auto";
						itemColumn.innerHTML = `
<div style="max-width: 150px;">
  <div class="card mb-2">
    <div class="p-2 text-center">
      <div class="mb-1">${colorBtn(outfit.data.headColor, "15px")}</div>
      <div class="mb-1">
        ${colorBtn(outfit.data.leftArmColor, "10px 10px 20px")}
        ${colorBtn(outfit.data.torsoColor, "20px")}
        ${colorBtn(outfit.data.rightArmColor, "10px 10px 20px")}
      </div>
      ${colorBtn(outfit.data.leftLegColor, "10px 10px 20px")}
      ${colorBtn(outfit.data.rightLegColor, "10px 10px 20px")}
    </div>
  </div>
  <h6 class="text-truncate mb-0 text-reset text-center mb-2">${outfit.name}</h6>
  <div class="btn-group w-100">
    <button class="btn btn-primary btn-sm p+outfit_wear_button">Wear</button>
    <div class="btn-group">
      <button type="button" class="btn btn-warning dropdown-toggle btn-sm" data-bs-toggle="dropdown" aria-expanded="false">
        <i class="fa-duotone fa-wrench"></i>
      </button>
      <ul class="dropdown-menu">
        <li><a class="dropdown-item text-primary p+outfit_rename_button" href="#"><i class="fa-solid fa-signature"></i> Rename</a></li>
        <li><span class="p+outfit_overwrite_button dropdown-item text-warning"><i class="fa-solid fa-wand-magic-sparkles"></i> <span>Overwrite</span></span></li>
        <li><hr class="dropdown-divider"></li>
        <li><span class="p+outfit_delete_button dropdown-item text-danger"><i class="fa-duotone fa-trash"></i> <span>Delete</span></span></li>
      </ul>
    </div>
  </div>
</div>`;
						inventory.appendChild(itemColumn);

						itemColumn
							.getElementsByClassName("p+outfit_wear_button")[0]
							.addEventListener("click", () => {
								if (avatar === outfit.data) return;
								console.log("Equipped Outfit: ", outfit);
								avatar = outfit.data;
								updateAvatar();
							});

						itemColumn
							.getElementsByClassName("p+outfit_rename_button")[0]
							.addEventListener("click", () => {
								if (!isVerified) return;
								renameTargetIndex = index;
								outfitRenameModal.showModal();
								outfitRenameNameEl.innerText = outfit.name;
								(
									outfitRenameButton.previousElementSibling as HTMLInputElement
								).value = outfit.name;
							});

						setupPendingButton(
							itemColumn.getElementsByClassName(
								"p+outfit_overwrite_button",
							)[0] as HTMLElement,
							"Overwrite",
							() => {
								if (!isVerified) return;
								outfits![index].data = avatar;
								if (tabSelected === "outfit") loadItems();
								persistOutfits();
							},
						);

						setupPendingButton(
							itemColumn.getElementsByClassName(
								"p+outfit_delete_button",
							)[0] as HTMLElement,
							"Delete",
							() => {
								if (!isVerified) return;
								outfits!.splice(index, 1);
								if (tabSelected === "outfit") loadItems();
								persistOutfits();
							},
						);
					},
				);
			}
		} else {
			inventory.classList.remove("itemgrid");
			inventory.innerHTML = `
<div class="text-muted" style="padding: 37px 30px;">
  <h1 class="display-3"><i class="fas fa-box-open"></i></h1>
  <h6 class="mb-0">You do not have any items matching this type or search query. Find new items in the <a href="/store">store</a>!</h6>
</div>`;
		}
	}

	function loadWearing(): void {
		document.getElementById("wearing")!.innerHTML = "";

		[
			...avatar.items,
			...(avatar.clothing ?? []),
			avatar.face,
			avatar.tool,
			avatar.body,
		]
			.filter((x): x is number | string => x !== undefined)
			.forEach((id) => {
				const cached = itemCache[id.toString()];
				if (cached === undefined) return;

				cached.creator ??= { id: 1, name: "-" };
				cached.price ??= "???" as unknown as null;

				const ribbon = chooseRibbon(cached, true);

				const itemColumn = document.createElement("div");
				itemColumn.classList.value = "col-auto";
				itemColumn.innerHTML = `
<div style="max-width: 150px;">
  <div class="card mb-2 avatar-item-container">
    ${ribbon ?? ""}
    <div class="p-2">
      <img src="${cached.thumbnail}" class="img-fluid" style="border-radius: 10px;">
      <button class="avatarAction btn btn-danger btn-sm position-absolute rounded-circle text-center" style="top: -10px; right: -16px; width: 32px; height: 32px; z-index: 1;"><i class="fas fa-minus"></i></button>
    </div>
  </div>
  <a href="${(id as number) > 0 ? `/store/${id}` : `https://poly-archive.vercel.app/archive/${Math.abs(id as number)}`}" class="text-reset">
    <h6 class="text-truncate mb-0">${cached.name}</h6>
  </a>
  <small class="text-muted d-block text-truncate">${formatTypeDisplay(cached)}</small>
  <small style="font-size: 0.8rem;" class="d-block text-truncate mb-2 ${formatPrice(cached.price)}
</div>`;
				document.getElementById("wearing")!.appendChild(itemColumn);

				itemColumn
					.getElementsByClassName("p-2")[0]
					.addEventListener("click", () => {
						wearAsset(cached, id);
					});

				if (ribbon !== null) {
					itemColumn
						.getElementsByClassName("ribbon")[0]
						.addEventListener("click", () => {
							wearAsset(cached, id);
						});
				}
			});
	}

	function wearAsset(details: CachedItem, id: number | string): void {
		const avatarRecord = avatar as Record<string, unknown>;
		const numericId = typeof id === "string" ? parseInt(id, 10) : id;

		if (details.type === "hat") {
			const isEquipped = avatar.items.indexOf(numericId) !== -1;
			if (!isEquipped) avatar.items.push(id);
			else avatar.items.splice(avatar.items.indexOf(numericId), 1);
		} else if (details.type === "clothing") {
			avatar.clothing ??= [];
			const isEquipped = avatar.clothing.indexOf(numericId) !== -1;
			if (!isEquipped) avatar.clothing.push(id);
			else avatar.clothing.splice(avatar.clothing.indexOf(numericId), 1);
		} else {
			const isEquipped = avatarRecord[details.type] === id;
			if (!isEquipped) avatarRecord[details.type] = id;
			else avatarRecord[details.type] = undefined;
		}

		updateAvatar();
		loadWearing();
	}

	function updateBodyColors(): void {
		const bodyColorMap: Record<string, string> = {
			head: avatar.headColor,
			torso: avatar.torsoColor,
			leftArm: avatar.leftArmColor,
			rightArm: avatar.rightArmColor,
			leftLeg: avatar.leftLegColor,
			rightLeg: avatar.rightLegColor,
		};

		Object.entries(bodyColorMap).forEach(([elementId, color]) => {
			const el = document.getElementById(elementId);
			if (el) el.style.backgroundColor = color;
		});
	}

	function setupPendingButton(
		el: HTMLElement,
		defaultLabel: string,
		onConfirm: () => void,
	): void {
		let pending = false;
		el.addEventListener("click", (e) => {
			e.stopPropagation();
			if (!pending) {
				pending = true;
				(el.children[1] as HTMLElement).innerText = "Are you sure?";
				setTimeout(() => {
					if (pending) {
						(el.children[1] as HTMLElement).innerText = defaultLabel;
						pending = false;
					}
				}, 3000);
			} else {
				pending = false;
				onConfirm();
			}
		});
	}

	function cleanAccessoryType(type: string): string {
		const map: Record<string, string> = {
			hat: "Hat",
			backAccessory: "Back Accessory",
			faceAccessory: "Face Accessory",
			headAttachment: "Head Attachment",
			hair: "Hair",
			neckAccessory: "Neck Accessory",
			headCover: "Head Cover",
			headAccessory: "Head Accessory",
			frontAccessory: "Front Accessory",
		};
		return map[type] ?? type;
	}

	function formatPrice(price: number | null | false | string): string {
		if (price === 0) return 'text-primary fw-bold">Free</small>';
		if (price === false) return 'text-muted fw-bold">Offsale</small>';
		if (price === null || price === "???") return 'text-muted">???</small>';
		return `text-success"><i class="pi mr-1">$</i> ${price}</small>`;
	}

	function chooseRibbon(item: CachedItem, wearing: boolean): string | null {
		const threeDaysAgo = new Date();
		threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

		if (item.ribbon === "custom")
			return '<div class="ribbon ribbon-polyplus-custom ribbon-top-right"><span>Custom</span></div>';
		if (item.ribbon === "unknown")
			return '<div class="ribbon ribbon-polyplus-unknown ribbon-top-right"><span><i>?</i></span></div>';
		if (item.ribbon === "retro" && wearing)
			return '<div class="ribbon ribbon-polyplus-retro ribbon-top-right"><span>Retro</span></div>';
		if (item.isLimited)
			return '<div class="ribbon ribbon-limited ribbon-top-right"><span><i class="fas fa-star" style="display: inline-block"></i></span></div>';
		if (item.createdAt !== undefined && new Date(item.createdAt) > threeDaysAgo)
			return '<div class="ribbon ribbon-new ribbon-top-right"><span>New</span></div>';
		return null;
	}

	function formatTypeDisplay(item: CachedItem): string {
		if (["hat", "tool", "face", "torso"].includes(item.type)) {
			if (item.type === "hat")
				return cleanAccessoryType(item.accessoryType ?? "hat");
			if (item.type === "torso") return "Body Part";
			return item.type[0].toUpperCase() + item.type.slice(1);
		}
		return `by <a class="text-muted" href="/u/${item.creator!.name}">${item.creator!.name}</a>`;
	}

	_avatarSandboxOutfits.watch((newValue) => {
		outfits = newValue ?? [];
	});
}