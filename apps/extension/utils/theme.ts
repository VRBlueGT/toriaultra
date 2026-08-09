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

import { Theme } from "@kiln/schemas";
import metadata from "@/utils/static/metadata.json";
import type { ThemeEffect } from "./types";

export const {
	EFFECT_SLOTS,
	EFFECT_TYPE_CONFIGS,
	FONTS,
	THEME_PRESETS,
	COLOR_TOKENS,
	SELECTOR_REFERENCE,
	hexToRgb,
	rgbToHex,
	rgbToHsl,
	hslToRgb,
	darkenHex,
	lightenHex,
	getContrastColor,
	isValidHex,
	hexToIconFilter,
	buildThemeCSS,
} = Theme;

export function proxyThemeImageUrl(url: string): string {
	const trimmed = url.trim();
	if (
		!trimmed ||
		trimmed.startsWith("data:") ||
		trimmed.startsWith(metadata.endpoints.extension)
	)
		return trimmed;
	return `${metadata.endpoints.extension}theme/image?url=${encodeURIComponent(trimmed)}`;
}

export function buildEffectsCSS(effects: ThemeEffect[]): string {
	return Theme.buildEffectsCSS(effects, proxyThemeImageUrl);
}

export function applyKilnTheme(
	colors: {
		accentColor: string;
		navbarColor: string;
		customCss?: string;
		fontFamily?: string;
		backgroundImage?: string;
		backgroundOverlayColor?: string;
		backgroundOverlayOpacity?: number;
		effects?: ThemeEffect[];
		navbarIconColor?: string;
		cursorUrl?: string;
		colorTokens?: Record<string, string>;
	} | null,
) {
	document.getElementById("kiln-custom-theme")?.remove();
	document.getElementById("kiln-custom-bg")?.remove();
	document.getElementById("kiln-custom-effects")?.remove();
	document.getElementById("kiln-custom-tokens")?.remove();
	document.getElementById("kiln-custom-css")?.remove();
	document.getElementById("kiln-custom-font")?.remove();
	document.getElementById("kiln-custom-cursor")?.remove();
	if (!colors) return;

	const font =
		colors.fontFamily && colors.fontFamily !== "default"
			? FONTS[colors.fontFamily]
			: null;

	if (font?.googleFamily) {
		const link = document.createElement("link");
		link.id = "kiln-custom-font";
		link.rel = "stylesheet";
		link.href = `https://fonts.googleapis.com/css2?family=${font.googleFamily}&display=swap`;
		document.head.appendChild(link);
	}

	const themeStyle = document.createElement("style");
	themeStyle.id = "kiln-custom-theme";
	let css = buildThemeCSS(
		colors.accentColor,
		colors.navbarColor,
		colors.navbarIconColor,
		browser.runtime.getURL("/svgs/logo.svg" as any),
	);
	if (font?.localFile) {
		const fontUrl = browser.runtime.getURL(font.localFile as any);
		const fontName = font.stack.match(/^'([^']+)'/)?.[1] ?? "KilnCustomFont";
		css =
			`@font-face { font-family: '${fontName}'; src: url('${fontUrl}') format('truetype'); }\n` +
			css;
	}
	if (font?.stack) {
		css += `\nbody, :root { font-family: ${font.stack} !important; --bs-body-font-family: ${font.stack}; }`;
	}
	themeStyle.textContent = css;
	document.head.appendChild(themeStyle);

	if (colors.backgroundImage?.trim()) {
		const bgStyle = document.createElement("style");
		bgStyle.id = "kiln-custom-bg";
		const imgUrl = `url(${JSON.stringify(proxyThemeImageUrl(colors.backgroundImage))})`;
		const opacity = colors.backgroundOverlayOpacity ?? 0;
		const hasOverlay = opacity > 0 && colors.backgroundOverlayColor;
		let bgImage: string;
		if (hasOverlay) {
			const [r, g, b] = hexToRgb(colors.backgroundOverlayColor!);
			const a = (opacity / 100).toFixed(3);
			bgImage = `linear-gradient(rgba(${r},${g},${b},${a}),rgba(${r},${g},${b},${a})), ${imgUrl}`;
		} else {
			bgImage = imgUrl;
		}
		bgStyle.textContent = `body { background-image: ${bgImage} !important; background-size: cover !important; background-attachment: fixed !important; background-position: center !important; background-repeat: no-repeat !important; }`;
		document.head.appendChild(bgStyle);
	}

	if (colors.effects?.length) {
		const effectsStyle = document.createElement("style");
		effectsStyle.id = "kiln-custom-effects";
		effectsStyle.textContent = buildEffectsCSS(colors.effects);
		document.head.appendChild(effectsStyle);
	}

	if (colors.colorTokens && Object.keys(colors.colorTokens).length > 0) {
		const tokensStyle = document.createElement("style");
		tokensStyle.id = "kiln-custom-tokens";
		tokensStyle.textContent = Object.entries(colors.colorTokens)
			.filter(([, v]) => v)
			.map(([k, v]) => COLOR_TOKENS[k]?.apply(v) ?? "")
			.filter(Boolean)
			.join("\n");
		document.head.appendChild(tokensStyle);
	}

	if (colors.customCss?.trim()) {
		const customStyle = document.createElement("style");
		customStyle.id = "kiln-custom-css";
		customStyle.textContent = colors.customCss;
		document.head.appendChild(customStyle);
	}

	if (colors.cursorUrl?.trim()) {
		const cursorStyle = document.createElement("style");
		cursorStyle.id = "kiln-custom-cursor";
		const safeUrl = JSON.stringify(colors.cursorUrl.trim());
		cursorStyle.textContent = `* { cursor: url(${safeUrl}) 0 0, auto !important; }`;
		document.head.appendChild(cursorStyle);
	}
}

export function extractDominantColor(imageUrl: string): Promise<string> {
	return new Promise((resolve) => {
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.onload = () => {
			const SIZE = 64;
			const canvas = document.createElement("canvas");
			canvas.width = SIZE;
			canvas.height = SIZE;
			const ctx = canvas.getContext("2d")!;
			ctx.drawImage(img, 0, 0, SIZE, SIZE);
			const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

			type HSLPixel = { h: number; s: number; l: number };
			const pixels: HSLPixel[] = [];

			for (let i = 0; i < data.length; i += 4) {
				const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
				if (a < 128) continue;
				const [h, s, l] = rgbToHsl(r, g, b);
				if (l >= 0.1 && l <= 0.9 && s >= 0.25) {
					pixels.push({ h, s, l });
				}
			}

			if (pixels.length === 0) {
				resolve("#2563eb");
				return;
			}

			pixels.sort((a, b) => b.s - a.s);
			const top = pixels.slice(0, Math.max(1, Math.floor(pixels.length * 0.3)));

			let sinSum = 0;
			let cosSum = 0;
			for (const p of top) {
				sinSum += Math.sin(p.h * Math.PI * 2);
				cosSum += Math.cos(p.h * Math.PI * 2);
			}
			const avgHue =
				Math.atan2(sinSum / top.length, cosSum / top.length) / (Math.PI * 2);
			const hue = avgHue < 0 ? avgHue + 1 : avgHue;

			const avgSat = top.reduce((s, p) => s + p.s, 0) / top.length;
			const finalSat = Math.min(0.85, Math.max(0.55, avgSat));

			const [r, g, b] = hslToRgb(hue, finalSat, 0.5);
			resolve(rgbToHex(r, g, b));
		};
		img.onerror = () => resolve("#2563eb");
		img.src = imageUrl;
	});
}
