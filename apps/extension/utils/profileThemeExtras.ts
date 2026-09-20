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

import type { Extension } from "@kiln/schemas";
import { POLYTORIA_CDN_URL } from "@/utils/decal";
import { FONTS, hexToRgb } from "@/utils/theme";

export type ProfileLayout = Extension.ProfileLayout;
export type ProfileUsernameStyle = Extension.ProfileUsernameStyle;
export type ProfileBanner = Extension.ProfileBanner;
export type ProfileAmbient = Extension.ProfileAmbient;
export type ProfileSticker = Extension.ProfileSticker;
export type ProfileNote = Extension.ProfileNote;
export type ProfileCardStyle = Extension.ProfileCardStyle;
export type ProfileAvatarBackdrop = Extension.ProfileAvatarBackdrop;
export type ProfilePointerEffects = Extension.ProfilePointerEffects;
export type ProfileAmbientType = ProfileAmbient["type"];

export type ProfileThemeExtras = {
	layout?: ProfileLayout;
	usernameStyle?: ProfileUsernameStyle;
	banner?: ProfileBanner;
	ambient?: ProfileAmbient;
	stickers?: ProfileSticker[];
	notes?: ProfileNote[];
	cardStyle?: ProfileCardStyle;
	avatarBackdrop?: ProfileAvatarBackdrop;
	pointerEffects?: ProfilePointerEffects;
};

export const MAX_STICKERS = 10;
export const MAX_NOTES = 10;

export type ProfileSectionKey =
	| "info"
	| "streak"
	| "records"
	| "rankings"
	| "divide"
	| "avatar"
	| "about"
	| "achievements"
	| "creations"
	| "images"
	| "tabs";

export const PROFILE_SECTIONS: {
	key: ProfileSectionKey;
	label: string;
	column: "left" | "right";
}[] = [
	{ key: "info", label: "Info", column: "left" },
	{ key: "streak", label: "Streak", column: "left" },
	{ key: "records", label: "Historical Records", column: "left" },
	{ key: "rankings", label: "Ranking Positions", column: "left" },
	{ key: "divide", label: "The Great Divide", column: "left" },
	{ key: "avatar", label: "Avatar", column: "right" },
	{ key: "about", label: "About", column: "right" },
	{ key: "achievements", label: "Pinned Achievements", column: "right" },
	{ key: "creations", label: "Creations", column: "right" },
	{ key: "images", label: "Images", column: "right" },
	{ key: "tabs", label: "Friends / Guilds / Wall", column: "right" },
];

export function stickerAnchorLabel(key: string): string {
	if (key === "banner") return "Banner";
	if (key === "avatar-card") return "Avatar Card";
	if (key === PAGE_ANCHOR) return "Profile";
	return PROFILE_SECTIONS.find((s) => s.key === key)?.label ?? key;
}

export const CARD_PRESET_OPACITY: Record<ProfileCardStyle["preset"], number> = {
	solid: 100,
	glass: 45,
	outline: 0,
	gradient: 85,
};

export const NO_POINTER_EFFECTS_ATTR = "data-kiln-pt-no-effects";

export const AMBIENT_TYPES: {
	key: ProfileAmbientType;
	label: string;
	color: string;
}[] = [
	{ key: "snow", label: "Snow", color: "#ffffff" },
	{ key: "stars", label: "Twinkling Stars", color: "#fff6c8" },
	{ key: "rain", label: "Rain", color: "#9cc7ff" },
	{ key: "bubbles", label: "Bubbles", color: "#bfe8ff" },
	{ key: "fireflies", label: "Fireflies", color: "#d7ff6b" },
	{ key: "petals", label: "Petals", color: "#ffb7d5" },
];

const BASE_STYLE_ID = "kiln-pt-base";
const USERNAME_STYLE_ID = "kiln-pt-username";
const USERNAME_FONT_ID = "kiln-pt-username-font";
const BANNER_ID = "kiln-pt-banner";
const AMBIENT_ID = "kiln-pt-ambient";
const HIDDEN_CLASS = "kiln-pt-hidden";
const STICKER_CLASS = "kiln-pt-sticker";
const STICKER_LAYER_ID = "kiln-pt-stickers";
const NOTE_CLASS = "kiln-pt-note";
const NOTE_LAYER_ID = "kiln-pt-notes";
const PAGE_ANCHOR = "page";

const SECTION_TITLE_ICONS: [string, ProfileSectionKey][] = [
	["fa-user-circle", "info"],
	["fa-ranking-star", "rankings"],
	["fa-swords", "divide"],
	["fa-star", "records"],
	["fa-user-crown", "avatar"],
	["fa-info-circle", "about"],
	["fa-trophy", "achievements"],
	["fa-pen-ruler", "creations"],
	["fa-image", "images"],
];

type StickerEditing = {
	onStickerMove: (id: string, anchor: string, x: number, y: number) => void;
	onNoteMove?: (id: string, anchor: string, x: number, y: number) => void;
	ignoreWithin?: HTMLElement;
};

let current: ProfileThemeExtras | null = null;
let editing: StickerEditing | null = null;
let layoutTouched = false;
let columnObserver: MutationObserver | null = null;

function ensureBaseStyle() {
	if (document.getElementById(BASE_STYLE_ID)) return;
	const style = document.createElement("style");
	style.id = BASE_STYLE_ID;
	style.textContent = `
		.${HIDDEN_CLASS} { display: none !important; }
		.${STICKER_CLASS} {
			position: absolute;
			pointer-events: none;
			user-select: none;
			-webkit-user-drag: none;
			max-width: none !important;
		}
		.${NOTE_CLASS} {
			position: absolute;
			pointer-events: none;
			user-select: none;
			max-width: 220px;
			padding: 10px 12px;
			border-radius: 6px;
			box-shadow: 0 4px 14px rgba(0,0,0,0.35);
			line-height: 1.3;
			white-space: pre-wrap;
			word-break: break-word;
			text-align: left;
		}
		.${STICKER_CLASS}.kiln-pt-sticker-editable,
		.${NOTE_CLASS}.kiln-pt-sticker-editable {
			outline: 1px dashed rgba(255,255,255,0.45);
			outline-offset: 2px;
		}
		html.kiln-pt-grab, html.kiln-pt-grab * { cursor: grab !important; }
		html.kiln-pt-grabbing, html.kiln-pt-grabbing * {
			cursor: grabbing !important;
			user-select: none !important;
		}
		@keyframes kiln-pt-shimmer {
			from { background-position: 0% center; }
			to { background-position: 200% center; }
		}
	`;
	document.head.appendChild(style);
}

function getColumns(): { left: HTMLElement | null; right: HTMLElement | null } {
	const left = document.querySelector<HTMLElement>(".user-right");
	const right =
		left?.parentElement?.querySelector<HTMLElement>(":scope > .col-8") ?? null;
	return { left, right };
}

function sectionKeyOf(el: Element): ProfileSectionKey | null {
	if (el.id === "user-streak-card") return "streak";
	if (el.querySelector("#user-menu-tabs-card")) return "tabs";
	const title = el.matches("h6.section-title")
		? el
		: el.querySelector(":scope > h6.section-title");
	const icon = title?.querySelector("i");
	if (!icon) return null;
	for (const [cls, key] of SECTION_TITLE_ICONS)
		if (icon.classList.contains(cls)) return key;
	return null;
}

type SectionGroup = { key: ProfileSectionKey | null; els: HTMLElement[] };

function groupColumn(column: HTMLElement): SectionGroup[] {
	const groups: SectionGroup[] = [];
	for (const child of Array.from(column.children) as HTMLElement[]) {
		const key = sectionKeyOf(child);
		if (key || groups.length === 0) groups.push({ key, els: [child] });
		else groups[groups.length - 1].els.push(child);
	}
	return groups;
}

function findSectionGroup(key: string): SectionGroup | null {
	const { left, right } = getColumns();
	for (const column of [left, right]) {
		if (!column) continue;
		const group = groupColumn(column).find((g) => g.key === key);
		if (group) return group;
	}
	return null;
}

function applyLayout(layout: ProfileLayout | undefined) {
	if (!layout && !layoutTouched) return;
	layoutTouched = !!layout;

	const order = layout?.order ?? [];
	const hidden = new Set(layout?.hidden ?? []);
	const defaultRank = (key: string) =>
		1000 + PROFILE_SECTIONS.findIndex((s) => s.key === key);
	const rank = (key: string) => {
		const i = order.indexOf(key);
		return i === -1 ? defaultRank(key) : i;
	};

	for (const column of Object.values(getColumns())) {
		if (!column) continue;
		const groups = groupColumn(column);

		for (const group of groups) {
			const hide = !!group.key && hidden.has(group.key);
			for (const el of group.els) el.classList.toggle(HIDDEN_CLASS, hide);
		}

		const pinned = groups.filter((g) => !g.key);
		const sorted = groups
			.filter((g) => g.key)
			.sort((a, b) => rank(a.key!) - rank(b.key!));
		const desired = [...pinned, ...sorted].flatMap((g) => g.els);
		const actual = Array.from(column.children);
		if (desired.every((el, i) => actual[i] === el)) continue;
		for (const el of desired) column.appendChild(el);
	}
}

function watchColumns() {
	if (columnObserver) return;
	columnObserver = new MutationObserver(() => {
		columnObserver?.disconnect();
		applyLayout(current?.layout);
		renderStickers();
		renderNotes();
		observeColumns();
	});
	observeColumns();
}

function observeColumns() {
	if (!columnObserver) return;
	for (const column of Object.values(getColumns()))
		if (column) columnObserver.observe(column, { childList: true });
}

function applyUsernameStyle(style: ProfileUsernameStyle | undefined) {
	document.getElementById(USERNAME_STYLE_ID)?.remove();
	const fontLink = document.getElementById(USERNAME_FONT_ID);
	if (!style) {
		fontLink?.remove();
		return;
	}

	const rules: string[] = [];
	if (style.mode === "gradient") {
		const c2 = style.color2 ?? style.color1;
		const stops = style.animated
			? `${style.color1}, ${c2}, ${style.color1}`
			: `${style.color1}, ${c2}`;
		rules.push(
			`background-image: linear-gradient(90deg, ${stops}) !important`,
			"-webkit-background-clip: text !important",
			"background-clip: text !important",
			"color: transparent !important",
			"-webkit-text-fill-color: transparent !important",
		);
		if (style.animated)
			rules.push(
				"background-size: 200% auto !important",
				"animation: kiln-pt-shimmer 3s linear infinite",
			);
	} else {
		rules.push(
			`color: ${style.color1} !important`,
			`-webkit-text-fill-color: ${style.color1} !important`,
		);
	}

	if (style.glowColor && style.glowSize)
		rules.push(
			`filter: drop-shadow(0 0 ${style.glowSize}px ${style.glowColor})`,
		);

	const font =
		style.fontFamily && style.fontFamily !== "default"
			? FONTS[style.fontFamily]
			: null;
	let fontFace = "";
	if (font?.googleFamily) {
		if (fontLink?.getAttribute("data-family") !== font.googleFamily) {
			fontLink?.remove();
			const link = document.createElement("link");
			link.id = USERNAME_FONT_ID;
			link.rel = "stylesheet";
			link.href = `https://fonts.googleapis.com/css2?family=${font.googleFamily}&display=swap`;
			link.setAttribute("data-family", font.googleFamily);
			document.head.appendChild(link);
		}
	} else {
		fontLink?.remove();
	}
	if (font?.localFile) {
		const fontName = font.stack.match(/^'([^']+)'/)?.[1] ?? "KilnUsernameFont";
		fontFace = `@font-face { font-family: '${fontName}'; src: url('${browser.runtime.getURL(font.localFile as any)}') format('truetype'); }\n`;
	}
	if (font?.stack) rules.push(`font-family: ${font.stack} !important`);

	const el = document.createElement("style");
	el.id = USERNAME_STYLE_ID;
	el.textContent = `${fontFace}.user-right h4.text-themeglow > [class^="userlink-"] { ${rules.join("; ")}; }`;
	document.head.appendChild(el);
}

function applyBanner(banner: ProfileBanner | undefined) {
	let el = document.getElementById(BANNER_ID);
	if (!banner || !POLYTORIA_CDN_URL.test(banner.url)) {
		el?.remove();
		return;
	}

	const container = document
		.querySelector(".user-right")
		?.closest<HTMLElement>(".container");
	if (!container) return;

	if (!el) {
		el = document.createElement("div");
		el.id = BANNER_ID;
		Object.assign(el.style, {
			position: "relative",
			width: "100%",
			marginBottom: "1rem",
			borderRadius: "var(--bs-border-radius-lg, 12px)",
			backgroundSize: "cover",
			backgroundRepeat: "no-repeat",
		});
		container.prepend(el);
	}
	el.style.height = `${banner.height}px`;
	el.style.backgroundImage = `url(${JSON.stringify(banner.url)})`;
	el.style.backgroundPosition = `center ${banner.position}`;
}

type Particle = {
	x: number;
	y: number;
	size: number;
	speed: number;
	drift: number;
	phase: number;
	spin: number;
};

let ambientKey = "";
let ambientTeardown: (() => void) | null = null;

function stopAmbient() {
	ambientTeardown?.();
	ambientTeardown = null;
	ambientKey = "";
}

function applyAmbient(ambient: ProfileAmbient | undefined) {
	const key = ambient ? JSON.stringify(ambient) : "";
	if (key === ambientKey) return;
	stopAmbient();
	if (!ambient) return;
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
	ambientKey = key;

	const type = ambient.type;
	const color =
		ambient.color ?? AMBIENT_TYPES.find((t) => t.key === type)?.color ?? "#fff";
	const [r, g, b] = hexToRgb(color);
	const rgba = (a: number) => `rgba(${r},${g},${b},${a})`;

	const canvas = document.createElement("canvas");
	canvas.id = AMBIENT_ID;
	Object.assign(canvas.style, {
		position: "fixed",
		inset: "0",
		width: "100vw",
		height: "100vh",
		pointerEvents: "none",
		zIndex: "1",
	});
	document.body.appendChild(canvas);
	const ctx = canvas.getContext("2d")!;

	let width = 0;
	let height = 0;
	const resize = () => {
		const dpr = window.devicePixelRatio || 1;
		width = window.innerWidth;
		height = window.innerHeight;
		canvas.width = width * dpr;
		canvas.height = height * dpr;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	};
	resize();

	const perDensity: Record<ProfileAmbientType, number> = {
		snow: 60,
		stars: 70,
		rain: 90,
		bubbles: 25,
		fireflies: 20,
		petals: 25,
	};
	const count = Math.round(
		perDensity[type] * Math.min(3, Math.max(1, ambient.density)),
	);
	const spawn = (anywhere: boolean): Particle => {
		const rising = type === "bubbles" || type === "fireflies";
		return {
			x: Math.random() * width,
			y: anywhere ? Math.random() * height : rising ? height + 20 : -20,
			size:
				type === "rain"
					? 10 + Math.random() * 14
					: type === "bubbles"
						? 4 + Math.random() * 10
						: type === "petals"
							? 5 + Math.random() * 5
							: 1 + Math.random() * 2.5,
			speed:
				type === "rain"
					? 9 + Math.random() * 6
					: type === "stars"
						? 0
						: type === "fireflies"
							? 0.15 + Math.random() * 0.3
							: 0.4 + Math.random() * 1.1,
			drift: (Math.random() - 0.5) * 0.6,
			phase: Math.random() * Math.PI * 2,
			spin: (Math.random() - 0.5) * 0.04,
		};
	};
	const particles = Array.from({ length: count }, () => spawn(true));

	const tick = (time: number) => {
		ctx.clearRect(0, 0, width, height);
		for (let i = 0; i < particles.length; i++) {
			const p = particles[i];
			const t = time / 1000;
			switch (type) {
				case "snow": {
					p.y += p.speed;
					p.x += Math.sin(t + p.phase) * 0.4 + p.drift;
					ctx.fillStyle = rgba(0.85);
					ctx.beginPath();
					ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
					ctx.fill();
					break;
				}
				case "rain": {
					p.y += p.speed;
					p.x += p.drift;
					ctx.strokeStyle = rgba(0.45);
					ctx.lineWidth = 1;
					ctx.beginPath();
					ctx.moveTo(p.x, p.y);
					ctx.lineTo(p.x + p.drift * 2, p.y + p.size);
					ctx.stroke();
					break;
				}
				case "stars": {
					const alpha = 0.25 + 0.75 * Math.abs(Math.sin(t * 0.8 + p.phase));
					ctx.fillStyle = rgba(alpha);
					ctx.beginPath();
					ctx.arc(p.x, p.y, p.size * 0.8, 0, Math.PI * 2);
					ctx.fill();
					break;
				}
				case "bubbles": {
					p.y -= p.speed;
					p.x += Math.sin(t * 1.5 + p.phase) * 0.5;
					ctx.strokeStyle = rgba(0.55);
					ctx.lineWidth = 1.2;
					ctx.beginPath();
					ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
					ctx.stroke();
					break;
				}
				case "fireflies": {
					p.y -= p.speed * Math.sin(t * 0.5 + p.phase);
					p.x += Math.cos(t * 0.7 + p.phase) * 0.6;
					const alpha = 0.3 + 0.7 * Math.abs(Math.sin(t * 1.3 + p.phase));
					ctx.shadowBlur = 12;
					ctx.shadowColor = rgba(alpha);
					ctx.fillStyle = rgba(alpha);
					ctx.beginPath();
					ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
					ctx.fill();
					ctx.shadowBlur = 0;
					break;
				}
				case "petals": {
					p.y += p.speed;
					p.x += Math.sin(t + p.phase) * 0.8 + p.drift;
					p.phase += p.spin;
					ctx.save();
					ctx.translate(p.x, p.y);
					ctx.rotate(p.phase);
					ctx.fillStyle = rgba(0.8);
					ctx.beginPath();
					ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
					ctx.fill();
					ctx.restore();
					break;
				}
			}

			const out =
				p.y > height + 30 || p.y < -30 || p.x < -30 || p.x > width + 30;
			if (out) {
				particles[i] = type === "fireflies" ? spawn(true) : spawn(false);
			}
		}
		frame = requestAnimationFrame(tick);
	};

	let frame = 0;
	window.addEventListener("resize", resize);
	ambientTeardown = () => {
		cancelAnimationFrame(frame);
		window.removeEventListener("resize", resize);
		canvas.remove();
	};

	frame = requestAnimationFrame(tick);
}

function stickerAnchors(): Map<HTMLElement, string> {
	const anchors = new Map<HTMLElement, string>();
	const banner = document.getElementById(BANNER_ID);
	if (banner) anchors.set(banner, "banner");
	const avatarCard = document.getElementById("user-avatar-card");
	if (avatarCard) anchors.set(avatarCard, "avatar-card");
	for (const { key } of PROFILE_SECTIONS) {
		const card = findSectionGroup(key)
			?.els.map((el) =>
				el.classList.contains("card")
					? el
					: el.querySelector<HTMLElement>(".card"),
			)
			.find(Boolean);
		if (card) anchors.set(card, key);
	}
	const page =
		document.querySelector<HTMLElement>(".user-right")?.parentElement;
	if (page) anchors.set(page, PAGE_ANCHOR);
	return anchors;
}

function stickerLayer(): HTMLElement {
	let layer = document.getElementById(STICKER_LAYER_ID);
	if (!layer) {
		layer = document.createElement("div");
		layer.id = STICKER_LAYER_ID;
		Object.assign(layer.style, {
			position: "absolute",
			top: "0",
			left: "0",
			width: "0",
			height: "0",
		});
		document.body.appendChild(layer);
	}
	return layer;
}

function noteLayer(): HTMLElement {
	let layer = document.getElementById(NOTE_LAYER_ID);
	if (!layer) {
		layer = document.createElement("div");
		layer.id = NOTE_LAYER_ID;
		Object.assign(layer.style, {
			position: "absolute",
			top: "0",
			left: "0",
			width: "0",
			height: "0",
		});
		document.body.appendChild(layer);
	}
	return layer;
}

let dragging: {
	el: HTMLElement;
	offsetX: number;
	offsetY: number;
	moved: boolean;
} | null = null;

function positionPinLayer(
	layerId: string,
	pins: { id: string; anchor: string; x: number; y: number }[],
) {
	const layer = document.getElementById(layerId);
	if (!layer) return;
	const byKey = new Map<string, HTMLElement>();
	for (const [el, key] of stickerAnchors()) byKey.set(key, el);

	for (const node of Array.from(layer.children) as HTMLElement[]) {
		if (node === dragging?.el) continue;
		const pin = pins.find((p) => p.id === node.dataset.pinId);
		const rect = pin && byKey.get(pin.anchor)?.getBoundingClientRect();
		if (!pin || !rect || (!rect.width && !rect.height)) {
			node.style.display = "none";
			continue;
		}
		node.style.display = "";
		node.style.left = `${rect.left + window.scrollX + (rect.width * pin.x) / 100}px`;
		node.style.top = `${rect.top + window.scrollY + (rect.height * pin.y) / 100}px`;
	}
}

function positionStickers() {
	positionPinLayer(STICKER_LAYER_ID, current?.stickers ?? []);
}

function positionNotes() {
	positionPinLayer(NOTE_LAYER_ID, current?.notes ?? []);
}

let positionFrame = 0;
function schedulePositionPins() {
	if (positionFrame) return;
	positionFrame = requestAnimationFrame(() => {
		positionFrame = 0;
		positionStickers();
		positionNotes();
	});
}

let pinResizeObserver: ResizeObserver | null = null;

function syncPinLifecycle() {
	const active = !!(current?.stickers?.length || current?.notes?.length);
	if (active && !pinResizeObserver) {
		pinResizeObserver = new ResizeObserver(schedulePositionPins);
		pinResizeObserver.observe(document.body);
		window.addEventListener("resize", schedulePositionPins);
	} else if (!active && pinResizeObserver) {
		pinResizeObserver.disconnect();
		pinResizeObserver = null;
		window.removeEventListener("resize", schedulePositionPins);
	}
}

function renderStickers() {
	if (dragging) return;
	const stickers = (current?.stickers ?? []).filter((s) =>
		POLYTORIA_CDN_URL.test(s.url),
	);

	if (stickers.length === 0) {
		document.getElementById(STICKER_LAYER_ID)?.remove();
		return;
	}

	const layer = stickerLayer();
	layer.replaceChildren(
		...stickers.map((sticker) => {
			const img = document.createElement("img");
			img.className = STICKER_CLASS;
			if (editing) img.classList.add("kiln-pt-sticker-editable");
			img.src = sticker.url;
			img.alt = "";
			img.draggable = false;
			img.dataset.pinId = sticker.id;
			img.dataset.stickerId = sticker.id;
			Object.assign(img.style, {
				width: `${sticker.size}px`,
				transform: `translate(-50%, -50%) rotate(${sticker.rotation}deg)`,
				zIndex: sticker.layer === "back" ? "-1" : "900",
			});
			img.addEventListener("load", schedulePositionPins, { once: true });
			return img;
		}),
	);
	positionStickers();
}

function renderNotes() {
	if (dragging) return;
	const notes = current?.notes ?? [];

	if (notes.length === 0) {
		document.getElementById(NOTE_LAYER_ID)?.remove();
		return;
	}

	const layer = noteLayer();
	layer.replaceChildren(
		...notes.map((note) => {
			const div = document.createElement("div");
			div.className = NOTE_CLASS;
			if (editing) div.classList.add("kiln-pt-sticker-editable");
			div.textContent = note.text;
			div.dataset.pinId = note.id;
			div.dataset.noteId = note.id;
			Object.assign(div.style, {
				fontSize: `${note.size}px`,
				color: note.color,
				background: note.background,
				transform: `translate(-50%, -50%) rotate(${note.rotation}deg)`,
				zIndex: note.layer === "back" ? "-1" : "900",
			});
			return div;
		}),
	);
	positionNotes();
}

function pinAt(x: number, y: number): HTMLElement | null {
	const nodes = [STICKER_LAYER_ID, NOTE_LAYER_ID].flatMap((id) => {
		const layer = document.getElementById(id);
		return layer ? (Array.from(layer.children) as HTMLElement[]) : [];
	});
	const sorted = nodes
		.reverse()
		.sort((a, b) => Number(b.style.zIndex) - Number(a.style.zIndex));
	return (
		sorted.find((node) => {
			if (node.style.display === "none") return false;
			const r = node.getBoundingClientRect();
			return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
		}) ?? null
	);
}

function isIgnoredTarget(target: EventTarget | null) {
	return (
		!!editing?.ignoreWithin &&
		target instanceof Node &&
		editing.ignoreWithin.contains(target)
	);
}

function onEditPointerMove(e: PointerEvent) {
	const root = document.documentElement;
	if (!dragging) {
		root.classList.toggle(
			"kiln-pt-grab",
			!isIgnoredTarget(e.target) && !!pinAt(e.clientX, e.clientY),
		);
		return;
	}
	dragging.moved = true;
	dragging.el.style.left = `${e.pageX - dragging.offsetX}px`;
	dragging.el.style.top = `${e.pageY - dragging.offsetY}px`;
}

function onEditPointerDown(e: PointerEvent) {
	if (e.button !== 0 || isIgnoredTarget(e.target)) return;
	const el = pinAt(e.clientX, e.clientY);
	if (!el) return;
	e.preventDefault();
	e.stopPropagation();
	const r = el.getBoundingClientRect();
	dragging = {
		el,
		offsetX: e.clientX - (r.left + r.width / 2),
		offsetY: e.clientY - (r.top + r.height / 2),
		moved: false,
	};
	document.documentElement.classList.remove("kiln-pt-grab");
	document.documentElement.classList.add("kiln-pt-grabbing");
}

function onEditPointerUp(e: PointerEvent) {
	if (!dragging) return;
	const { el, offsetX, offsetY, moved } = dragging;
	dragging = null;
	document.documentElement.classList.remove("kiln-pt-grabbing");

	window.addEventListener(
		"click",
		(click) => {
			click.preventDefault();
			click.stopPropagation();
		},
		{ capture: true, once: true },
	);
	if (!moved) return;

	const placement = stickerPlacementAt(
		e.clientX - offsetX,
		e.clientY - offsetY,
	);
	if (!placement) return;
	if (el.dataset.stickerId)
		editing?.onStickerMove(
			el.dataset.stickerId,
			placement.anchor,
			placement.x,
			placement.y,
		);
	else if (el.dataset.noteId)
		editing?.onNoteMove?.(
			el.dataset.noteId,
			placement.anchor,
			placement.x,
			placement.y,
		);
}

export function stickerPlacementAt(
	clientX: number,
	clientY: number,
): { anchor: string; x: number; y: number } | null {
	const anchors = stickerAnchors();

	let anchorEl: HTMLElement | null = null;
	for (const hit of document.elementsFromPoint(clientX, clientY)) {
		for (let n: Element | null = hit; n; n = n.parentElement) {
			if (anchors.has(n as HTMLElement)) {
				anchorEl = n as HTMLElement;
				break;
			}
		}
		if (anchorEl) break;
	}
	anchorEl ??= [...anchors].find(([, key]) => key === PAGE_ANCHOR)?.[0] ?? null;
	if (!anchorEl) return null;

	const rect = anchorEl.getBoundingClientRect();
	if (!rect.width || !rect.height) return null;
	const toPercent = (offset: number, size: number) =>
		Math.round(Math.min(150, Math.max(-50, (offset / size) * 100)) * 100) / 100;
	return {
		anchor: anchors.get(anchorEl)!,
		x: toPercent(clientX - rect.left, rect.width),
		y: toPercent(clientY - rect.top, rect.height),
	};
}

let editListenersAttached = false;
function setEditListeners(attach: boolean) {
	if (attach === editListenersAttached) return;
	editListenersAttached = attach;
	const method = attach ? "addEventListener" : "removeEventListener";
	window[method]("pointerdown", onEditPointerDown as EventListener, true);
	window[method]("pointermove", onEditPointerMove as EventListener, true);
	window[method]("pointerup", onEditPointerUp as EventListener, true);
	if (!attach) {
		dragging = null;
		document.documentElement.classList.remove(
			"kiln-pt-grab",
			"kiln-pt-grabbing",
		);
	}
}

const CARD_STYLE_ID = "kiln-pt-cards";
const PAGE_CLASS = "kiln-pt-page";
const OUTER_CARD = `.${PAGE_CLASS} .card:not(.card .card)`;

function getProfileRow(): HTMLElement | null {
	return (
		document.querySelector<HTMLElement>(".user-right")?.parentElement ?? null
	);
}

let tiltTeardown: (() => void) | null = null;

function applyCardStyle(style: ProfileCardStyle | undefined) {
	document.getElementById(CARD_STYLE_ID)?.remove();
	tiltTeardown?.();
	tiltTeardown = null;
	const row = getProfileRow();
	if (!style || !row) {
		row?.classList.remove(PAGE_CLASS);
		return;
	}
	row.classList.add(PAGE_CLASS);

	const alpha = (style.opacity ?? CARD_PRESET_OPACITY[style.preset]) / 100;
	const tint = style.tint ? hexToRgb(style.tint).join(",") : null;
	const base = tint ?? "var(--bs-tertiary-bg-rgb, 33,37,41)";
	const accent = tint ?? "var(--bs-primary-rgb, 59,175,255)";

	const rules: string[] = [];
	switch (style.preset) {
		case "solid":
			rules.push(`background-color: rgba(${base}, ${alpha}) !important`);
			break;
		case "glass":
			rules.push(
				`background-color: rgba(${base}, ${alpha}) !important`,
				"backdrop-filter: blur(12px) saturate(140%)",
				"-webkit-backdrop-filter: blur(12px) saturate(140%)",
				"border-color: rgba(255,255,255,0.14) !important",
			);
			break;
		case "outline":
			rules.push(
				`background-color: rgba(${base}, ${alpha}) !important`,
				`border: 1px solid rgba(${accent}, 0.7) !important`,
			);
			break;
		case "gradient":
			rules.push(
				"background-color: transparent !important",
				`background-image: linear-gradient(135deg, rgba(${accent}, ${alpha * 0.45}), rgba(${base}, ${alpha})) !important`,
			);
			break;
	}
	if (style.radius !== undefined)
		rules.push(`border-radius: ${style.radius}px !important`);

	let css = `${OUTER_CARD} { ${rules.join("; ")}; }`;
	const hover = style.hover ?? "none";
	if (hover !== "none")
		css += `\n${OUTER_CARD} { transition: transform 0.2s ease, box-shadow 0.2s ease; }`;
	if (hover === "lift")
		css += `\n${OUTER_CARD}:hover { transform: translateY(-4px); box-shadow: 0 12px 28px rgba(0,0,0,0.35); }`;
	if (hover === "glow")
		css += `\n${OUTER_CARD}:hover { box-shadow: 0 0 0 1px rgba(${accent}, 0.6), 0 0 22px rgba(${accent}, 0.35); }`;

	const el = document.createElement("style");
	el.id = CARD_STYLE_ID;
	el.textContent = css;
	document.head.appendChild(el);

	if (hover === "tilt") tiltTeardown = enableTilt(row);
}

function enableTilt(row: HTMLElement): () => void {
	let tilted: HTMLElement | null = null;
	const reset = () => {
		if (tilted) tilted.style.transform = "";
		tilted = null;
	};
	const onMove = (e: PointerEvent) => {
		const card = (e.target as Element | null)?.closest<HTMLElement>(
			".card:not(.card .card)",
		);
		if (card !== tilted) reset();
		if (!card || !row.contains(card)) return;
		tilted = card;
		const r = card.getBoundingClientRect();
		const px = (e.clientX - r.left) / r.width - 0.5;
		const py = (e.clientY - r.top) / r.height - 0.5;
		card.style.transform = `perspective(900px) rotateX(${(-py * 6).toFixed(2)}deg) rotateY(${(px * 6).toFixed(2)}deg)`;
	};
	row.addEventListener("pointermove", onMove);
	row.addEventListener("pointerleave", reset);
	return () => {
		row.removeEventListener("pointermove", onMove);
		row.removeEventListener("pointerleave", reset);
		reset();
	};
}

const AVATAR_BACKDROP_ID = "kiln-pt-avatar-backdrop";
const AVATAR_IFRAME_STYLE_ID = "kiln-pt-iframe-transparent";
let avatarIframeHooked = false;

function setAvatarIframeTransparent(transparent: boolean) {
	const iframe = document.getElementById(
		"avatar3dIframe",
	) as HTMLIFrameElement | null;
	if (!iframe) return;

	const sync = () => {
		try {
			const doc = iframe.contentDocument;
			if (!doc?.head) return;
			const existing = doc.getElementById(AVATAR_IFRAME_STYLE_ID);
			if (!document.getElementById(AVATAR_BACKDROP_ID)) {
				existing?.remove();
				return;
			}
			if (existing) return;
			const style = doc.createElement("style");
			style.id = AVATAR_IFRAME_STYLE_ID;
			style.textContent =
				"html, body, canvas { background: transparent !important; }";
			doc.head.appendChild(style);
		} catch {}
	};

	if (transparent && !avatarIframeHooked) {
		avatarIframeHooked = true;
		iframe.addEventListener("load", sync);
	}
	sync();
}

function applyAvatarBackdrop(backdrop: ProfileAvatarBackdrop | undefined) {
	document.getElementById(AVATAR_BACKDROP_ID)?.remove();
	let background: string | null = null;
	if (backdrop?.type === "gradient") {
		const alpha = (backdrop.opacity ?? 100) / 100;
		const [r1, g1, b1] = hexToRgb(backdrop.color1);
		const [r2, g2, b2] = hexToRgb(backdrop.color2);
		background = `linear-gradient(${backdrop.angle}deg, rgba(${r1},${g1},${b1},${alpha}), rgba(${r2},${g2},${b2},${alpha}))`;
	} else if (
		backdrop?.type === "image" &&
		POLYTORIA_CDN_URL.test(backdrop.url)
	) {
		const fade = 1 - (backdrop.opacity ?? 100) / 100;
		const image = `url(${JSON.stringify(backdrop.url)}) center / ${backdrop.fit} no-repeat`;
		background =
			fade > 0
				? `linear-gradient(rgba(var(--bs-tertiary-bg-rgb, 33,37,41), ${fade}), rgba(var(--bs-tertiary-bg-rgb, 33,37,41), ${fade})), ${image}`
				: image;
	}

	if (background) {
		const el = document.createElement("style");
		el.id = AVATAR_BACKDROP_ID;
		el.textContent = `#user-avatar-card .position-relative:has(> #avatar2dImg) { background: ${background} !important; border-radius: 10px; }`;
		document.head.appendChild(el);
	}
	setAvatarIframeTransparent(!!background);
}

type Spark = {
	kind: "star" | "heart" | "ring" | "rect" | "dot" | "glow";
	x: number;
	y: number;
	vx: number;
	vy: number;
	gravity: number;
	size: number;
	grow: number;
	life: number;
	maxLife: number;
	rotation: number;
	spin: number;
	color: string;
};

const POINTER_CANVAS_ID = "kiln-pt-pointer";
let pointerKey = "";
let pointerTeardown: (() => void) | null = null;

function drawStar(ctx: CanvasRenderingContext2D, r: number) {
	ctx.beginPath();
	for (let i = 0; i < 8; i++) {
		const radius = i % 2 === 0 ? r : r * 0.35;
		const angle = (Math.PI / 4) * i;
		ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
	}
	ctx.closePath();
	ctx.fill();
}

function drawHeart(ctx: CanvasRenderingContext2D, size: number) {
	const s = size / 2;
	ctx.beginPath();
	ctx.moveTo(0, s * 0.6);
	ctx.bezierCurveTo(-s * 1.2, -s * 0.2, -s * 0.5, -s * 1.1, 0, -s * 0.4);
	ctx.bezierCurveTo(s * 0.5, -s * 1.1, s * 1.2, -s * 0.2, 0, s * 0.6);
	ctx.fill();
}

function applyPointerEffects(effects: ProfilePointerEffects | undefined) {
	const active = !!effects && (!!effects.click || !!effects.trail);
	const key = active ? JSON.stringify(effects) : "";
	if (key === pointerKey) return;
	pointerTeardown?.();
	pointerTeardown = null;
	pointerKey = key;
	if (!active || window.matchMedia("(prefers-reduced-motion: reduce)").matches)
		return;

	const canvas = document.createElement("canvas");
	canvas.id = POINTER_CANVAS_ID;
	Object.assign(canvas.style, {
		position: "fixed",
		inset: "0",
		width: "100vw",
		height: "100vh",
		pointerEvents: "none",
		zIndex: "99990",
	});
	document.body.appendChild(canvas);
	const ctx = canvas.getContext("2d")!;

	const resize = () => {
		const dpr = window.devicePixelRatio || 1;
		canvas.width = window.innerWidth * dpr;
		canvas.height = window.innerHeight * dpr;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	};
	resize();

	const color = () =>
		effects!.color ??
		(getComputedStyle(document.documentElement)
			.getPropertyValue("--bs-primary")
			.trim() ||
			"#ffffff");
	const confettiColor = () =>
		effects!.color ?? `hsl(${Math.floor(Math.random() * 360)}, 90%, 62%)`;

	const sparks: Spark[] = [];
	const spark = (partial: Partial<Spark> & Pick<Spark, "kind" | "x" | "y">) =>
		sparks.push({
			vx: 0,
			vy: 0,
			gravity: 0,
			size: 6,
			grow: 0,
			life: 0,
			maxLife: 40,
			rotation: 0,
			spin: 0,
			color: color(),
			...partial,
		});

	let frame = 0;
	const tick = () => {
		ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
		for (let i = sparks.length - 1; i >= 0; i--) {
			const p = sparks[i];
			p.life++;
			if (p.life >= p.maxLife) {
				sparks.splice(i, 1);
				continue;
			}
			p.vy += p.gravity;
			p.x += p.vx;
			p.y += p.vy;
			p.size = Math.max(0, p.size + p.grow);
			p.rotation += p.spin;

			ctx.save();
			ctx.globalAlpha = 1 - p.life / p.maxLife;
			ctx.translate(p.x, p.y);
			ctx.rotate(p.rotation);
			ctx.fillStyle = p.color;
			ctx.strokeStyle = p.color;
			switch (p.kind) {
				case "star":
					drawStar(ctx, p.size);
					break;
				case "heart":
					drawHeart(ctx, p.size);
					break;
				case "ring":
					ctx.lineWidth = 2;
					ctx.beginPath();
					ctx.arc(0, 0, p.size, 0, Math.PI * 2);
					ctx.stroke();
					break;
				case "rect":
					ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
					break;
				case "dot":
					ctx.beginPath();
					ctx.arc(0, 0, p.size, 0, Math.PI * 2);
					ctx.fill();
					break;
				case "glow": {
					const g = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size);
					g.addColorStop(0, p.color);
					g.addColorStop(1, "transparent");
					ctx.fillStyle = g;
					ctx.beginPath();
					ctx.arc(0, 0, p.size, 0, Math.PI * 2);
					ctx.fill();
					break;
				}
			}
			ctx.restore();
		}
		frame = sparks.length ? requestAnimationFrame(tick) : 0;
	};
	const kick = () => {
		if (!frame) frame = requestAnimationFrame(tick);
	};

	const ignored = (target: EventTarget | null) =>
		target instanceof Element &&
		!!target.closest(`[${NO_POINTER_EFFECTS_ATTR}]`);

	const onDown = (e: PointerEvent) => {
		if (e.button !== 0 || ignored(e.target)) return;
		const { clientX: x, clientY: y } = e;
		const rand = (min: number, max: number) =>
			min + Math.random() * (max - min);
		switch (effects!.click) {
			case "sparkles":
				for (let i = 0; i < 10; i++) {
					const a = (Math.PI * 2 * i) / 10 + rand(-0.2, 0.2);
					const v = rand(1.5, 3.5);
					spark({
						kind: "star",
						x,
						y,
						vx: Math.cos(a) * v,
						vy: Math.sin(a) * v,
						size: rand(3, 6),
						maxLife: 34,
						spin: 0.15,
					});
				}
				break;
			case "hearts":
				for (let i = 0; i < 6; i++)
					spark({
						kind: "heart",
						x,
						y,
						vx: rand(-1.6, 1.6),
						vy: rand(-3, -1.5),
						size: rand(10, 16),
						maxLife: 48,
					});
				break;
			case "ripples":
				spark({ kind: "ring", x, y, size: 4, grow: 1.4, maxLife: 32 });
				spark({ kind: "ring", x, y, size: 1, grow: 0.9, maxLife: 40 });
				break;
			case "confetti":
				for (let i = 0; i < 18; i++)
					spark({
						kind: "rect",
						x,
						y,
						vx: rand(-4, 4),
						vy: rand(-6, -2),
						gravity: 0.25,
						size: rand(6, 10),
						maxLife: 60,
						spin: rand(-0.3, 0.3),
						color: confettiColor(),
					});
				break;
		}
		kick();
	};

	let lastX = -1000;
	let lastY = -1000;
	const onMove = (e: PointerEvent) => {
		if (!effects!.trail || ignored(e.target)) return;
		const { clientX: x, clientY: y } = e;
		if (Math.hypot(x - lastX, y - lastY) < 14) return;
		lastX = x;
		lastY = y;
		switch (effects!.trail) {
			case "sparkles":
				spark({
					kind: "star",
					x,
					y,
					vx: (Math.random() - 0.5) * 0.8,
					vy: 0.4,
					size: 4,
					maxLife: 28,
					spin: 0.1,
				});
				break;
			case "dots":
				spark({ kind: "dot", x, y, size: 3.5, grow: -0.12, maxLife: 26 });
				break;
			case "hearts":
				spark({ kind: "heart", x, y, vy: -0.6, size: 9, maxLife: 32 });
				break;
			case "glow":
				spark({ kind: "glow", x, y, size: 16, grow: -0.3, maxLife: 30 });
				break;
		}
		kick();
	};

	window.addEventListener("resize", resize);
	window.addEventListener("pointerdown", onDown, { passive: true });
	window.addEventListener("pointermove", onMove, { passive: true });
	pointerTeardown = () => {
		cancelAnimationFrame(frame);
		window.removeEventListener("resize", resize);
		window.removeEventListener("pointerdown", onDown);
		window.removeEventListener("pointermove", onMove);
		canvas.remove();
	};
}

export function applyProfileExtras(
	extras: ProfileThemeExtras | null,
	options: { editing?: StickerEditing } = {},
) {
	ensureBaseStyle();
	current = extras;
	editing = options.editing ?? null;

	columnObserver?.disconnect();
	applyLayout(extras?.layout);
	applyUsernameStyle(extras?.usernameStyle);
	applyBanner(extras?.banner);
	applyAmbient(extras?.ambient);
	applyCardStyle(extras?.cardStyle);
	applyAvatarBackdrop(extras?.avatarBackdrop);
	applyPointerEffects(extras?.pointerEffects);
	renderStickers();
	renderNotes();
	syncPinLifecycle();
	setEditListeners(
		!!editing && !!(extras?.stickers?.length || extras?.notes?.length),
	);

	if (extras) {
		if (columnObserver) observeColumns();
		else watchColumns();
	} else {
		columnObserver = null;
	}
}

export function clearProfileExtras() {
	applyProfileExtras(null);
}

export function extrasFromTheme(theme: {
	layout?: ProfileLayout | null;
	usernameStyle?: ProfileUsernameStyle | null;
	banner?: ProfileBanner | null;
	ambient?: ProfileAmbient | null;
	stickers?: ProfileSticker[] | null;
	notes?: ProfileNote[] | null;
	cardStyle?: ProfileCardStyle | null;
	avatarBackdrop?: ProfileAvatarBackdrop | null;
	pointerEffects?: ProfilePointerEffects | null;
}): ProfileThemeExtras {
	return {
		layout: theme.layout ?? undefined,
		usernameStyle: theme.usernameStyle ?? undefined,
		banner: theme.banner ?? undefined,
		ambient: theme.ambient ?? undefined,
		stickers: theme.stickers?.length ? theme.stickers : undefined,
		notes: theme.notes?.length ? theme.notes : undefined,
		cardStyle: theme.cardStyle ?? undefined,
		avatarBackdrop: theme.avatarBackdrop ?? undefined,
		pointerEffects: theme.pointerEffects ?? undefined,
	};
}
