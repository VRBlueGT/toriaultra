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

import { sendMessage } from "@/utils/messaging";
import { _savedThemes, apiSessions, preferences } from "@/utils/storage";
import {
	applyKilnTheme,
	COLOR_TOKENS,
	EFFECT_SLOTS,
	EFFECT_TYPE_CONFIGS,
	extractDominantColor,
	FONTS,
	hexToRgb,
	isValidHex,
	lightenHex,
	rgbToHex,
	THEME_PRESETS,
} from "@/utils/theme";
import type { ThemeEffect } from "@/utils/types";
import { createModal, getConfig } from "@/utils/utilities";

const RANDOM_ADJECTIVES = [
	"Solar",
	"Lunar",
	"Crimson",
	"Azure",
	"Ember",
	"Frost",
	"Golden",
	"Cobalt",
	"Scarlet",
	"Jade",
	"Violet",
	"Onyx",
	"Ivory",
	"Amber",
	"Slate",
	"Coral",
	"Sage",
	"Midnight",
	"Dawn",
	"Dusk",
	"Neon",
	"Pastel",
	"Misty",
	"Velvet",
];
const RANDOM_NOUNS = [
	"Harbor",
	"Prism",
	"Drift",
	"Bloom",
	"Forge",
	"Haven",
	"Ridge",
	"Shore",
	"Glow",
	"Crest",
	"Vale",
	"Peak",
	"Void",
	"Spark",
	"Haze",
	"Pulse",
	"Echo",
	"Surge",
	"Wave",
	"Dune",
	"Ash",
	"Mist",
	"Stone",
	"Flare",
];
function generateRandomThemeName(): string {
	const adj =
		RANDOM_ADJECTIVES[Math.floor(Math.random() * RANDOM_ADJECTIVES.length)];
	const noun = RANDOM_NOUNS[Math.floor(Math.random() * RANDOM_NOUNS.length)];
	return `${adj} ${noun}`;
}

interface TeWindowState {
	isOpen?: boolean;
	isFloating?: boolean;
	floatLeft?: number;
	floatTop?: number;
	width?: number;
	height?: number;
}

const TE_STATE_KEY = "kiln-te-window-state";

function loadTeState(): TeWindowState {
	try {
		return JSON.parse(sessionStorage.getItem(TE_STATE_KEY) ?? "{}");
	} catch {
		return {};
	}
}

function saveTeState(state: TeWindowState) {
	try {
		sessionStorage.setItem(TE_STATE_KEY, JSON.stringify(state));
	} catch {}
}

function friendlyApiError(
	message: string,
	fallback = "Something went wrong. Please try again.",
): string {
	if (message.includes("401"))
		return "Your session has expired. Reconnect your account and try again.";
	if (message.includes("403")) return "You don't have permission to do this.";
	if (message.includes("404")) return "The requested resource was not found.";
	if (message.includes("409"))
		return "A conflict occurred. This name may already be taken.";
	if (message.includes("422"))
		return "The theme data is invalid. Check your colors and settings.";
	if (message.includes("429"))
		return "Too many requests. Please wait a moment and try again.";
	if (message.includes("500") || message.includes("503"))
		return "Server error. Please try again later.";
	return fallback;
}

function parseColorAlpha(value: string | number): [string, number] {
	const s = String(value);
	const m = s.match(
		/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/,
	);
	if (m) {
		const hex = rgbToHex(
			parseInt(m[1], 10),
			parseInt(m[2], 10),
			parseInt(m[3], 10),
		);
		const alpha = Math.round(parseFloat(m[4]) * 100);
		return [hex, alpha];
	}
	if (isValidHex(s)) return [s, 100];
	return ["#1a1a1a", 100];
}

export function restoreThemeEditorIfNeeded(): void {
	if (loadTeState().isOpen && !document.getElementById("kiln-te-sidebar")) {
		openThemeEditorSidebar();
	}
}

export async function openThemeEditorSidebar(): Promise<void> {
	if (document.getElementById("kiln-te-sidebar")) return;
	saveTeState({ ...loadTeState(), isOpen: true });

	const values = await preferences.getPreferences();
	let savedThemes = await _savedThemes.getValue();

	const activeIdRaw =
		(values.config.themeCreator as any).activeThemeId ?? "default";
	const normalizeId = (id: string) => {
		if (id === "default") return "__default__";
		if (id in THEME_PRESETS) return `__preset__:${id}`;
		return id;
	};

	let currentId = normalizeId(activeIdRaw);
	let workingName = "";
	let workingAccent = "#3bafff";
	let workingNavbar = "#1a1a1a";
	let workingFont = "default";
	let workingCss = "";
	let workingBg = "";
	let workingOverlayColor = "#000000";
	let workingOverlayOpacity = 0;
	let workingEffects: ThemeEffect[] = [];
	let workingIconColor = "";
	let workingCursorSrc = "";
	let workingCursorScale = 32;
	let workingCursor = "";
	let workingColorTokens: Record<string, string> = {};
	let appliedOnce = false;

	function getCurrentSavedTheme() {
		if (currentId.startsWith("__")) return null;
		return savedThemes.find((t) => t.id === currentId) ?? null;
	}

	function isCustomTheme() {
		return !currentId.startsWith("__");
	}

	function isNew() {
		return currentId === "__new__";
	}

	function applyIdToState(id: string) {
		currentId = id;
		if (id === "__default__") {
			workingName = "Default (Polytoria)";
			workingAccent = "#3bafff";
			workingNavbar = "#1a1a1a";
			workingFont = "default";
			workingCss = "";
			workingBg = "";
			workingOverlayColor = "#000000";
			workingOverlayOpacity = 0;
			workingEffects = [];
			workingIconColor = "";
			workingCursorSrc = "";
			workingCursorScale = 32;
			workingCursor = "";
			workingColorTokens = {};
		} else if (id.startsWith("__preset__:")) {
			const key = id.slice(11);
			const p = THEME_PRESETS[key];
			workingName = p?.name ?? key;
			workingAccent = p?.accentColor ?? "#3bafff";
			workingNavbar = p?.navbarColor ?? "#1a1a1a";
			workingFont = "default";
			workingCss = "";
			workingBg = "";
			workingOverlayColor = "#000000";
			workingOverlayOpacity = 0;
			workingEffects = [];
			workingIconColor = "";
			workingCursorSrc = "";
			workingCursorScale = 32;
			workingCursor = "";
			workingColorTokens = {};
		} else if (id === "__new__") {
			workingName = generateRandomThemeName();
			workingAccent = "#3bafff";
			workingNavbar = "#1a1a1a";
			workingFont = "default";
			workingCss = "";
			workingBg = "";
			workingOverlayColor = "#000000";
			workingOverlayOpacity = 0;
			workingEffects = [];
			workingIconColor = "";
			workingCursorSrc = "";
			workingCursorScale = 32;
			workingCursor = "";
			workingColorTokens = {};
		} else {
			const t = savedThemes.find((t) => t.id === id);
			workingName = t?.name ?? "";
			workingAccent = t?.accentColor ?? "#3bafff";
			workingNavbar = t?.navbarColor ?? "#1a1a1a";
			workingFont = t?.fontFamily ?? "default";
			workingCss = t?.customCss ?? "";
			workingBg = t?.backgroundImage ?? "";
			workingOverlayColor = t?.backgroundOverlayColor ?? "#000000";
			workingOverlayOpacity = t?.backgroundOverlayOpacity ?? 0;
			workingEffects = t?.effects ? [...t.effects] : [];
			workingIconColor = t?.navbarIconColor ?? "";
			workingCursorSrc = t?.cursorUrl ?? "";
			workingCursorScale = t?.cursorScale ?? 32;
			workingCursor = "";
			workingColorTokens = t?.colorTokens ? { ...t.colorTokens } : {};
		}
	}

	applyIdToState(currentId);

	function getTokenDerivedValue(key: string): any {
		switch (key) {
			case "bodyBg":
				return workingNavbar;
			case "bodyText":
				return "#f6f6f6";
			case "cardBg":
				return lightenHex(workingNavbar, 7);
			case "linkColor":
				return workingAccent;
			case "mutedText":
				return "#888888";
		}
	}

	const styleEl = document.createElement("style");
	styleEl.textContent = `
		#kiln-te-sidebar {
			position: fixed;
			right: 0;
			top: 0;
			bottom: 0;
			width: 380px;
			background: var(--bs-body-bg, #212529);
			color: var(--bs-body-color, #fff);
			border-left: 1px solid rgba(128,128,128,0.2);
			box-shadow: -4px 0 32px rgba(0,0,0,0.55);
			z-index: 99999;
			font-size: 0.88rem;
			display: flex;
			flex-direction: column;
		}
		#kiln-te-sidebar-content {
			flex: 1;
			overflow-y: auto;
			padding: 14px 14px 8px;
		}
		#kiln-te-sidebar-footer {
			flex-shrink: 0;
			padding: 12px 14px;
			border-top: 1px solid rgba(128,128,128,0.15);
		}
		body.kiln-te-sidebar-open {
			margin-right: 380px !important;
		}
		#kiln-te-sidebar .kiln-te-color-picker {
			width: 34px;
			height: 28px;
			padding: 0;
			border: none;
			border-radius: 4px;
			cursor: pointer;
			background: none;
			flex-shrink: 0;
		}
		#kiln-te-sidebar .kiln-te-hex-input {
			flex: 1;
			min-width: 0;
		}
		#kiln-te-publish-status:empty {
			display: none;
		}
		#kiln-te-resize-handle {
			position: absolute;
			left: 0;
			top: 0;
			bottom: 0;
			width: 6px;
			cursor: ew-resize;
			z-index: 1;
			display: flex;
			align-items: center;
			justify-content: center;
			transition: background 0.15s;
		}
		#kiln-te-resize-handle:hover {
			background: rgba(128,128,128,0.15);
		}
		#kiln-te-resize-handle.kiln-te-dragging {
			background: rgba(128,128,128,0.25);
		}
		#kiln-te-resize-handle::after {
			content: '';
			width: 2px;
			height: 40px;
			background: rgba(128,128,128,0.35);
			border-radius: 1px;
			pointer-events: none;
		}
		#kiln-te-sidebar.kiln-te-floating {
			right: auto;
			bottom: auto;
			border-radius: 10px;
			box-shadow: 0 12px 48px rgba(0,0,0,0.8);
		}
		#kiln-te-sidebar.kiln-te-floating #kiln-te-sidebar-header {
			cursor: move;
		}
	`;
	document.head.appendChild(styleEl);

	const sidebar = document.createElement("div");
	sidebar.id = "kiln-te-sidebar";
	sidebar.innerHTML = `
		<div id="kiln-te-resize-handle"></div>
		<div id="kiln-te-sidebar-content">
		<div id="kiln-te-sidebar-header" class="d-flex justify-content-between align-items-center mb-2">
			<div class="d-flex align-items-center gap-2">
				<span class="fw-bold" style="font-size:1rem;">Theme Editor</span>
				<span class="badge bg-success" style="font-size:0.6em;vertical-align:middle;">Live Preview</span>
			</div>
			<div class="d-flex align-items-center gap-1">
				<button id="kiln-te-float-btn" title="Float as window"
				        style="background:rgba(128,128,128,0.15);border:1px solid rgba(128,128,128,0.3);border-radius:6px;padding:2px 8px;cursor:pointer;font-size:0.75rem;line-height:1.4;color:inherit;">
					<i class="fas fa-expand"></i>
				</button>
				<button id="kiln-te-close" aria-label="Close"
				        style="background:rgba(128,128,128,0.15);border:1px solid rgba(128,128,128,0.3);border-radius:6px;padding:2px 8px;cursor:pointer;font-size:1rem;line-height:1.4;color:inherit;">✕</button>
			</div>
		</div>

		<div class="d-flex align-items-center gap-2 mb-2">
			<select id="kiln-te-theme-select" class="form-select form-select-sm flex-fill"></select>
			<button id="kiln-te-name-pencil" title="Rename theme"
			        style="display:none;background:rgba(128,128,128,0.12);border:1px solid rgba(128,128,128,0.25);border-radius:5px;padding:4px 8px;cursor:pointer;color:inherit;flex-shrink:0;">
				<i class="fas fa-pencil" style="font-size:0.7rem;"></i>
			</button>
		</div>

		<span id="kiln-te-published-badge" class="badge mb-2 w-100" style="display:none;"></span>
		<hr class="mt-1 mb-2" style="border-color:rgba(128,128,128,0.18);">

		<div class="card mb-2">
			<div class="card-header fw-semibold d-flex justify-content-between align-items-center kiln-te-section-hdr" style="cursor:pointer;" data-body="kiln-te-colors-body">
				<span>Colors</span><i class="fas fa-chevron-up"></i>
			</div>
			<div class="card-body" id="kiln-te-colors-body">
				<div class="row g-2 mb-2">
					<div class="col-6">
						<label class="form-label small text-muted mb-1">Accent Color</label>
						<div class="d-flex align-items-center gap-2">
							<input type="color" id="kiln-te-accent-picker" class="kiln-te-color-picker" />
							<input type="text" id="kiln-te-accent-hex" class="form-control form-control-sm kiln-te-hex-input" maxlength="7" />
						</div>
					</div>
					<div class="col-6">
						<label class="form-label small text-muted mb-1">Bg / Navbar</label>
						<div class="d-flex align-items-center gap-2">
							<input type="color" id="kiln-te-navbar-picker" class="kiln-te-color-picker" />
							<input type="text" id="kiln-te-navbar-hex" class="form-control form-control-sm kiln-te-hex-input" maxlength="7" />
						</div>
					</div>
				</div>
				<div class="mb-2">
					<label class="form-label small text-muted mb-1">Extract Accent from Image</label>
					<div class="d-flex gap-1 flex-wrap align-items-center">
						<label class="btn btn-outline-secondary btn-sm mb-0" style="cursor:pointer;">
							<i class="fas fa-image me-1"></i>File
							<input type="file" id="kiln-te-image" accept="image/*" style="display:none;" />
						</label>
						<input type="text" id="kiln-te-image-url" class="form-control form-control-sm flex-fill"
						       placeholder="…or image URL" style="min-width:0;" />
						<button class="btn btn-outline-secondary btn-sm" id="kiln-te-image-url-btn">Extract</button>
					</div>
					<div id="kiln-te-image-status" class="small text-muted mt-1" style="min-height:1.1em;"></div>
				</div>
				<div>
					<label class="form-label small text-muted mb-1">Background Image</label>
					<div class="d-flex gap-1 align-items-center">
						<input type="text" id="kiln-te-bg-url" class="form-control form-control-sm flex-fill"
						       placeholder="Image URL…" style="min-width:0;" />
						<button class="btn btn-outline-secondary btn-sm" id="kiln-te-bg-set">Set</button>
						<button class="btn btn-outline-danger btn-sm" id="kiln-te-bg-clear" style="display:none;">Clear</button>
					</div>
					<div id="kiln-te-bg-overlay-row" class="mt-2" style="display:none;">
						<label class="form-label small text-muted mb-1">Overlay</label>
						<div class="d-flex align-items-center gap-2">
							<input type="color" id="kiln-te-bg-overlay-color" class="kiln-te-color-picker" />
							<input type="range" id="kiln-te-bg-overlay-opacity" min="0" max="100" step="1" class="flex-fill" style="min-width:0;" />
							<span id="kiln-te-bg-overlay-label" class="small text-muted" style="min-width:2.5em;text-align:right;">0%</span>
						</div>
					</div>
				</div>
				<div class="mt-2">
					<label class="form-label small text-muted mb-1">Custom Cursor</label>
					<div class="d-flex gap-1 align-items-center">
						<label class="btn btn-outline-secondary btn-sm mb-0 flex-shrink-0" style="cursor:pointer;">
							<i class="fas fa-mouse-pointer me-1"></i>Choose Image
							<input type="file" id="kiln-te-cursor-file" accept="image/*" style="display:none;" />
						</label>
						<span id="kiln-te-cursor-name" class="small text-muted flex-fill" style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></span>
						<button class="btn btn-outline-danger btn-sm flex-shrink-0" id="kiln-te-cursor-clear" style="display:none;">Clear</button>
					</div>
					<div id="kiln-te-cursor-scale-row" class="d-flex align-items-center gap-2 mt-1" style="display:none!important;">
						<label class="form-label small text-muted mb-0" style="white-space:nowrap;">Size</label>
						<input type="range" id="kiln-te-cursor-scale" min="16" max="128" step="4" value="32" class="flex-fill" style="min-width:0;" />
						<span id="kiln-te-cursor-scale-label" class="small text-muted" style="min-width:3em;text-align:right;">32px</span>
					</div>
				</div>
				<div class="mt-2">
					<div class="d-flex align-items-center mb-1">
						<label class="form-label small text-muted mb-0 flex-fill">Icon Color</label>
						<div class="form-check mb-0">
							<input type="checkbox" id="kiln-te-icon-auto" class="form-check-input" checked />
							<label for="kiln-te-icon-auto" class="form-check-label small text-muted">Auto</label>
						</div>
					</div>
					<div id="kiln-te-icon-color-row" class="d-flex align-items-center gap-2" style="display:none!important;">
						<input type="color" id="kiln-te-icon-picker" class="kiln-te-color-picker" />
						<input type="text" id="kiln-te-icon-hex" class="form-control form-control-sm kiln-te-hex-input" maxlength="7" />
					</div>
				</div>
			</div>
		</div>

		<div class="card mb-2">
			<div class="card-header fw-semibold d-flex justify-content-between align-items-center kiln-te-section-hdr" style="cursor:pointer;border-radius:inherit;border:none;" data-body="kiln-te-tokens-body">
				<span>Color Tokens</span><i class="fas fa-chevron-down"></i>
			</div>
			<div class="card-body" id="kiln-te-tokens-body" style="display:none;">
				<p class="small text-muted mb-2">Override specific derived colors. Default values are automatically derived from your accent and navbar values.</p>
				${Object.entries(COLOR_TOKENS)
					.map(
						([key, token]) => `
				<div class="mb-2">
					<label class="form-label small text-muted mb-1">${token.label}</label>
					<div class="d-flex align-items-center gap-2">
						<input type="color" id="kiln-te-token-${key}-picker" class="kiln-te-color-picker" />
						<input type="text" id="kiln-te-token-${key}-hex" class="form-control form-control-sm kiln-te-hex-input" maxlength="7" />
						<button class="btn btn-outline-secondary btn-sm flex-shrink-0" id="kiln-te-token-${key}-clear" title="Reset to auto" style="display:none;padding:2px 6px;font-size:0.7rem;">Auto</button>
					</div>
				</div>`,
					)
					.join("")}
			</div>
		</div>

		<div class="card mb-2">
			<div class="card-header fw-semibold d-flex justify-content-between align-items-center kiln-te-section-hdr" style="cursor:pointer;border-radius:inherit;border:none;" data-body="kiln-te-font-body">
				<span>Typography</span><i class="fas fa-chevron-down"></i>
			</div>
			<div class="card-body" id="kiln-te-font-body" style="display:none;">
				<div>
					<label class="form-label small text-muted mb-1">Font</label>
					<select id="kiln-te-font" class="form-select form-select-sm">
						${Object.entries(FONTS)
							.map(([key, f]) => `<option value="${key}">${f.name}</option>`)
							.join("")}
					</select>
				</div>
			</div>
		</div>

		<div class="card mb-2">
			<div class="card-header fw-semibold d-flex justify-content-between align-items-center kiln-te-section-hdr" style="cursor:pointer;border-radius:inherit;border:none;" data-body="kiln-te-effects-body">
				<span>Effects</span><i class="fas fa-chevron-down"></i>
			</div>
			<div class="card-body" id="kiln-te-effects-body" style="display:none;">
				<div id="kiln-te-effects-list"></div>
				<div id="kiln-te-add-effect-form" style="display:none;">
					<div class="row g-2 mb-2">
						<div class="col-6">
							<label class="form-label small text-muted mb-1">Slot</label>
							<select id="kiln-te-effect-slot" class="form-select form-select-sm"></select>
						</div>
						<div class="col-6">
							<label class="form-label small text-muted mb-1">Property</label>
							<select id="kiln-te-effect-type" class="form-select form-select-sm"></select>
						</div>
					</div>
					<div id="kiln-te-effect-value-row" class="mb-2"></div>
					<div class="d-flex gap-2">
						<button class="btn btn-sm btn-secondary flex-fill" id="kiln-te-effect-cancel">Cancel</button>
						<button class="btn btn-sm btn-primary flex-fill" id="kiln-te-effect-confirm">Add</button>
					</div>
				</div>
				<button class="btn btn-sm btn-outline-secondary w-100" id="kiln-te-effect-new">
					<i class="fas fa-plus me-1"></i>Add Effect
				</button>
			</div>
		</div>

		<div class="card mb-0">
			<div class="card-header fw-semibold d-flex justify-content-between align-items-center kiln-te-section-hdr" style="cursor:pointer;border-radius:inherit;border:none;" data-body="kiln-te-css-body">
				<span>Custom CSS</span><i class="fas fa-chevron-down"></i>
			</div>
			<div class="card-body" id="kiln-te-css-body" style="display:none;">
				<textarea id="kiln-te-custom-css" class="form-control form-control-sm mb-0" rows="5"
				          placeholder="/* e.g. .navbar { border-bottom: 2px solid var(--bs-primary); } */"
				          style="font-family:monospace;font-size:0.75rem;resize:vertical;"></textarea>
			</div>
		</div>
		</div>

		<div id="kiln-te-sidebar-footer">
			<div id="kiln-te-publish-status" class="small mb-2"></div>
			<div class="d-flex gap-1 mb-1">
				<button class="btn btn-sm btn-outline-secondary flex-fill" id="kiln-te-export-json">
					<i class="fas fa-file-export me-1"></i>Export JSON
				</button>
				<label class="btn btn-sm btn-outline-secondary flex-fill mb-0" style="cursor:pointer;">
					<i class="fas fa-file-import me-1"></i>Import JSON
					<input type="file" id="kiln-te-json-import-input" accept=".json,application/json" style="display:none;" />
				</label>
			</div>
			<div class="d-flex gap-1 mb-1" id="kiln-te-left-actions"></div>
			<button class="btn btn-primary btn-sm w-100" id="kiln-te-save">
				<i class="fas fa-check me-1"></i>Save & Apply
			</button>
		</div>

		<div id="kiln-te-rename-overlay" style="display:none;position:absolute;inset:0;z-index:10;background:rgba(0,0,0,0.55);align-items:center;justify-content:center;padding:24px;">
			<div style="background:var(--bs-body-bg,#212529);border:1px solid rgba(128,128,128,0.3);border-radius:8px;padding:16px;width:100%;">
				<p class="fw-bold mb-2" style="font-size:0.95rem;">Rename Theme</p>
				<input type="text" id="kiln-te-rename-input" class="form-control form-control-sm mb-3" maxlength="32" placeholder="Theme name…" />
				<div class="d-flex gap-2 justify-content-end">
					<button class="btn btn-sm btn-secondary" id="kiln-te-rename-cancel">Cancel</button>
					<button class="btn btn-sm btn-primary" id="kiln-te-rename-confirm">Rename</button>
				</div>
			</div>
		</div>

		<div id="kiln-te-import-overlay" style="display:none;position:absolute;inset:0;z-index:10;background:rgba(0,0,0,0.55);align-items:center;justify-content:center;padding:24px;">
			<div style="background:var(--bs-body-bg,#212529);border:1px solid rgba(128,128,128,0.3);border-radius:8px;padding:16px;width:100%;">
				<p class="fw-bold mb-1" style="font-size:0.95rem;">Import Theme</p>
				<p class="text-muted small mb-2">Paste a theme ID or URL to import a published theme.</p>
				<input type="text" id="kiln-te-import-input" class="form-control form-control-sm mb-2" placeholder="Theme ID or URL…" />
				<div id="kiln-te-import-status" class="small mb-2" style="min-height:1em;"></div>
				<div class="d-flex gap-2 justify-content-end">
					<button class="btn btn-sm btn-secondary" id="kiln-te-import-cancel">Cancel</button>
					<button class="btn btn-sm btn-primary" id="kiln-te-import-load">Import</button>
				</div>
			</div>
		</div>

		<div id="kiln-te-delete-overlay" style="display:none;position:absolute;inset:0;z-index:10;background:rgba(0,0,0,0.55);align-items:center;justify-content:center;padding:24px;">
			<div style="background:var(--bs-body-bg,#212529);border:1px solid rgba(128,128,128,0.3);border-radius:8px;padding:16px;width:100%;">
				<p class="fw-bold mb-2" style="font-size:0.95rem;">Delete Theme</p>
				<p class="text-muted small mb-3" id="kiln-te-delete-message"></p>
				<div class="d-flex gap-2 justify-content-end">
					<button class="btn btn-sm btn-secondary" id="kiln-te-delete-cancel">Cancel</button>
					<button class="btn btn-sm btn-danger" id="kiln-te-delete-confirm">
						<i class="fas fa-trash me-1"></i>Delete
					</button>
				</div>
			</div>
		</div>

	`;

	document.body.classList.add("kiln-te-sidebar-open");
	document.body.appendChild(sidebar);

	const resizeHandle = sidebar.querySelector<HTMLElement>(
		"#kiln-te-resize-handle",
	)!;
	let isResizing = false;
	let resizeAnchorRight = 0;

	function onResizeMouseMove(e: MouseEvent) {
		if (!isResizing) return;
		if (isFloating) {
			const newWidth = Math.max(
				300,
				Math.min(window.innerWidth * 0.8, resizeAnchorRight - e.clientX),
			);
			sidebar.style.width = `${newWidth}px`;
			sidebar.style.left = `${resizeAnchorRight - newWidth}px`;
		} else {
			const newWidth = Math.max(
				300,
				Math.min(window.innerWidth * 0.8, window.innerWidth - e.clientX),
			);
			sidebar.style.width = `${newWidth}px`;
			document.body.style.marginRight = `${newWidth}px`;
		}
	}
	function onResizeMouseUp() {
		if (!isResizing) return;
		isResizing = false;
		resizeHandle.classList.remove("kiln-te-dragging");
		document.body.style.userSelect = "";
		if (isFloating) {
			saveTeState({
				isOpen: true,
				isFloating: true,
				floatLeft: parseInt(sidebar.style.left, 10),
				floatTop: parseInt(sidebar.style.top, 10),
				width: sidebar.offsetWidth,
				height: parseInt(sidebar.style.height, 10),
			});
		} else {
			saveTeState({
				isOpen: true,
				isFloating: false,
				width: sidebar.offsetWidth,
			});
		}
	}

	resizeHandle.addEventListener("mousedown", (e) => {
		isResizing = true;
		resizeHandle.classList.add("kiln-te-dragging");
		document.body.style.userSelect = "none";
		if (isFloating) {
			resizeAnchorRight =
				parseInt(sidebar.style.left, 10) + sidebar.offsetWidth;
		}
		e.preventDefault();
	});
	document.addEventListener("mousemove", onResizeMouseMove);
	document.addEventListener("mouseup", onResizeMouseUp);

	const floatBtn =
		sidebar.querySelector<HTMLButtonElement>("#kiln-te-float-btn")!;
	const sidebarHeader = sidebar.querySelector<HTMLElement>(
		"#kiln-te-sidebar-header",
	)!;
	let isFloating = false;
	let isWindowDragging = false;
	let winDragStartX = 0,
		winDragStartY = 0;
	let winDragStartLeft = 0,
		winDragStartTop = 0;

	function toggleFloat() {
		isFloating = !isFloating;
		if (isFloating) {
			const rect = sidebar.getBoundingClientRect();
			sidebar.classList.add("kiln-te-floating");
			sidebar.style.left = `${rect.left}px`;
			sidebar.style.top = `${rect.top}px`;
			sidebar.style.height = `${Math.min(window.innerHeight * 0.85, 680)}px`;
			document.body.classList.remove("kiln-te-sidebar-open");
			document.body.style.marginRight = "";
			floatBtn.innerHTML = '<i class="fas fa-compress"></i>';
			floatBtn.title = "Dock to side";
			saveTeState({
				isOpen: true,
				isFloating: true,
				floatLeft: parseInt(sidebar.style.left, 10),
				floatTop: parseInt(sidebar.style.top, 10),
				width: sidebar.offsetWidth,
				height: parseInt(sidebar.style.height, 10),
			});
		} else {
			sidebar.classList.remove("kiln-te-floating");
			sidebar.style.left = "";
			sidebar.style.top = "";
			sidebar.style.height = "";
			sidebar.style.width = "";
			document.body.style.marginRight = "";
			document.body.classList.add("kiln-te-sidebar-open");
			floatBtn.innerHTML = '<i class="fas fa-expand"></i>';
			floatBtn.title = "Float as window";
			saveTeState({ isOpen: true, isFloating: false });
		}
	}

	function onWindowDragMove(e: MouseEvent) {
		if (!isWindowDragging) return;
		sidebar.style.left = `${winDragStartLeft + e.clientX - winDragStartX}px`;
		sidebar.style.top = `${winDragStartTop + e.clientY - winDragStartY}px`;
	}
	function onWindowDragUp() {
		if (!isWindowDragging) return;
		isWindowDragging = false;
		document.body.style.userSelect = "";
		saveTeState({
			isOpen: true,
			isFloating: true,
			floatLeft: parseInt(sidebar.style.left, 10),
			floatTop: parseInt(sidebar.style.top, 10),
			width: sidebar.offsetWidth,
			height: parseInt(sidebar.style.height, 10),
		});
	}

	sidebarHeader.addEventListener("mousedown", (e) => {
		if (!isFloating) return;
		if ((e.target as HTMLElement).closest("button")) return;
		isWindowDragging = true;
		winDragStartX = e.clientX;
		winDragStartY = e.clientY;
		winDragStartLeft = parseInt(sidebar.style.left, 10) || 0;
		winDragStartTop = parseInt(sidebar.style.top, 10) || 0;
		document.body.style.userSelect = "none";
		e.preventDefault();
	});
	document.addEventListener("mousemove", onWindowDragMove);
	document.addEventListener("mouseup", onWindowDragUp);
	floatBtn.addEventListener("click", toggleFloat);

	const themeSelect = sidebar.querySelector<HTMLSelectElement>(
		"#kiln-te-theme-select",
	)!;
	const publishedBadge = sidebar.querySelector<HTMLElement>(
		"#kiln-te-published-badge",
	)!;
	const namePencil = sidebar.querySelector<HTMLButtonElement>(
		"#kiln-te-name-pencil",
	)!;
	const accentPicker = sidebar.querySelector<HTMLInputElement>(
		"#kiln-te-accent-picker",
	)!;
	const accentHex = sidebar.querySelector<HTMLInputElement>(
		"#kiln-te-accent-hex",
	)!;
	const navbarPicker = sidebar.querySelector<HTMLInputElement>(
		"#kiln-te-navbar-picker",
	)!;
	const navbarHex = sidebar.querySelector<HTMLInputElement>(
		"#kiln-te-navbar-hex",
	)!;
	const fontSelect = sidebar.querySelector<HTMLSelectElement>("#kiln-te-font")!;
	const cssTextarea = sidebar.querySelector<HTMLTextAreaElement>(
		"#kiln-te-custom-css",
	)!;
	const imageInput = sidebar.querySelector<HTMLInputElement>("#kiln-te-image")!;
	const imageUrlInput =
		sidebar.querySelector<HTMLInputElement>("#kiln-te-image-url")!;
	const imageUrlBtn = sidebar.querySelector<HTMLButtonElement>(
		"#kiln-te-image-url-btn",
	)!;
	const imageStatus = sidebar.querySelector<HTMLElement>(
		"#kiln-te-image-status",
	)!;
	const bgUrlInput =
		sidebar.querySelector<HTMLInputElement>("#kiln-te-bg-url")!;
	const bgSetBtn = sidebar.querySelector<HTMLButtonElement>("#kiln-te-bg-set")!;
	const bgClearBtn =
		sidebar.querySelector<HTMLButtonElement>("#kiln-te-bg-clear")!;
	const bgOverlayRow = sidebar.querySelector<HTMLElement>(
		"#kiln-te-bg-overlay-row",
	)!;
	const bgOverlayColor = sidebar.querySelector<HTMLInputElement>(
		"#kiln-te-bg-overlay-color",
	)!;
	const bgOverlayOpacity = sidebar.querySelector<HTMLInputElement>(
		"#kiln-te-bg-overlay-opacity",
	)!;
	const bgOverlayLabel = sidebar.querySelector<HTMLElement>(
		"#kiln-te-bg-overlay-label",
	)!;
	const cursorFileInput = sidebar.querySelector<HTMLInputElement>(
		"#kiln-te-cursor-file",
	)!;
	const cursorNameEl = sidebar.querySelector<HTMLElement>(
		"#kiln-te-cursor-name",
	)!;
	const cursorClearBtn = sidebar.querySelector<HTMLButtonElement>(
		"#kiln-te-cursor-clear",
	)!;
	const cursorScaleRow = sidebar.querySelector<HTMLElement>(
		"#kiln-te-cursor-scale-row",
	)!;
	const cursorScaleInput = sidebar.querySelector<HTMLInputElement>(
		"#kiln-te-cursor-scale",
	)!;
	const cursorScaleLabel = sidebar.querySelector<HTMLElement>(
		"#kiln-te-cursor-scale-label",
	)!;
	const iconAutoCheck =
		sidebar.querySelector<HTMLInputElement>("#kiln-te-icon-auto")!;
	const iconColorRow = sidebar.querySelector<HTMLElement>(
		"#kiln-te-icon-color-row",
	)!;
	const iconPicker = sidebar.querySelector<HTMLInputElement>(
		"#kiln-te-icon-picker",
	)!;
	const iconHex = sidebar.querySelector<HTMLInputElement>("#kiln-te-icon-hex")!;
	const publishStatus = sidebar.querySelector<HTMLElement>(
		"#kiln-te-publish-status",
	)!;
	const leftActions = sidebar.querySelector<HTMLElement>(
		"#kiln-te-left-actions",
	)!;
	const saveBtn = sidebar.querySelector<HTMLButtonElement>("#kiln-te-save")!;
	const exportJsonBtn = sidebar.querySelector<HTMLButtonElement>(
		"#kiln-te-export-json",
	)!;
	const jsonImportInput = sidebar.querySelector<HTMLInputElement>(
		"#kiln-te-json-import-input",
	)!;

	function closeSidebar() {
		if (!appliedOnce) {
			const activeId =
				(values.config.themeCreator as any).activeThemeId ?? "default";
			if (activeId === "default") applyKilnTheme(null);
			else if (activeId in THEME_PRESETS)
				applyKilnTheme(THEME_PRESETS[activeId]);
			else applyKilnTheme(savedThemes.find((t) => t.id === activeId) ?? null);
		}
		document.removeEventListener("mousemove", onResizeMouseMove);
		document.removeEventListener("mouseup", onResizeMouseUp);
		document.removeEventListener("mousemove", onWindowDragMove);
		document.removeEventListener("mouseup", onWindowDragUp);
		document.body.style.marginRight = "";
		document.body.style.userSelect = "";
		saveTeState({ isOpen: false });
		sidebar.remove();
		styleEl.remove();
		document.body.classList.remove("kiln-te-sidebar-open");
		const url = new URL(window.location.href);
		url.searchParams.delete("kiln-theme-editor");
		history.replaceState(null, "", url);
	}

	function buildSelect() {
		themeSelect.innerHTML = "";
		themeSelect.add(new Option("Default (Polytoria)", "__default__"));
		const presetGroup = document.createElement("optgroup");
		presetGroup.label = "Built-in Presets";
		for (const [key, p] of Object.entries(THEME_PRESETS))
			presetGroup.appendChild(new Option(p.name, `__preset__:${key}`));
		themeSelect.add(presetGroup);
		if (savedThemes.length > 0) {
			const myGroup = document.createElement("optgroup");
			myGroup.label = "My Themes";
			for (const t of savedThemes)
				myGroup.appendChild(new Option(t.name, t.id));
			themeSelect.add(myGroup);
		}
		themeSelect.add(new Option("— New Theme —", "__new__"));
		themeSelect.value = currentId;
	}

	function refreshPreview() {
		if (currentId === "__default__") {
			applyKilnTheme(null);
			return;
		}
		if (
			isNew() &&
			workingAccent === "#3bafff" &&
			workingNavbar === "#1a1a1a" &&
			workingFont === "default" &&
			!workingCss &&
			!workingCursorSrc
		) {
			applyKilnTheme(null);
			return;
		}
		applyKilnTheme({
			accentColor: workingAccent,
			navbarColor: workingNavbar,
			fontFamily: workingFont,
			customCss: workingCss,
			backgroundImage: workingBg,
			backgroundOverlayColor: workingOverlayColor,
			backgroundOverlayOpacity: workingOverlayOpacity,
			effects: workingEffects,
			navbarIconColor: workingIconColor || undefined,
			cursorUrl: workingCursor || undefined,
			colorTokens:
				Object.keys(workingColorTokens).length > 0
					? workingColorTokens
					: undefined,
		});
	}

	function formatEffectValue(effect: ThemeEffect): string {
		const cfg = EFFECT_TYPE_CONFIGS[effect.type];
		if (cfg.input.kind === "slider") return `${effect.value}${cfg.input.unit}`;
		if (cfg.input.kind === "select") {
			return (
				cfg.input.options.find((o) => o.value === effect.value)?.label ??
				String(effect.value)
			);
		}
		if (cfg.input.kind === "url")
			return effect.value ? "Custom frame" : "(none)";
		if (cfg.input.kind === "color-alpha") {
			const [hex, alpha] = parseColorAlpha(effect.value);
			return alpha < 100 ? `${hex} (${alpha}%)` : hex;
		}
		return String(effect.value);
	}

	function renderEffectsList() {
		const list = sidebar.querySelector<HTMLElement>("#kiln-te-effects-list")!;
		if (workingEffects.length === 0) {
			list.innerHTML = "";
			return;
		}
		list.innerHTML = workingEffects
			.map(
				(effect) => `
				<div class="d-flex align-items-center gap-2 mb-1" data-effect-id="${effect.id}">
					<span class="badge bg-secondary" style="font-size:0.65em;flex-shrink:0;">${EFFECT_SLOTS[effect.slot].label}</span>
					<span class="small flex-fill" style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${EFFECT_TYPE_CONFIGS[effect.type].label}: <span class="text-muted">${formatEffectValue(effect)}</span></span>
					<button class="kiln-te-effect-remove" data-id="${effect.id}"
					        style="background:none;border:none;padding:0 2px;cursor:pointer;color:rgba(255,255,255,0.4);font-size:0.8rem;line-height:1;flex-shrink:0;"
					        title="Remove">✕</button>
				</div>`,
			)
			.join("");
		list
			.querySelectorAll<HTMLButtonElement>(".kiln-te-effect-remove")
			.forEach((btn) => {
				btn.addEventListener("click", async () => {
					await clonePresetIfNeeded();
					workingEffects = workingEffects.filter(
						(e) => e.id !== btn.dataset.id,
					);
					renderEffectsList();
					refreshPreview();
				});
			});
	}

	function syncInputsToState() {
		accentPicker.value = workingAccent;
		accentHex.value = workingAccent;
		navbarPicker.value = workingNavbar;
		navbarHex.value = workingNavbar;
		fontSelect.value = workingFont;
		cssTextarea.value = workingCss;
		bgUrlInput.value = workingBg;
		bgClearBtn.style.display = workingBg ? "" : "none";
		bgOverlayRow.style.display = workingBg ? "" : "none";
		bgOverlayColor.value = workingOverlayColor;
		bgOverlayOpacity.value = String(workingOverlayOpacity);
		bgOverlayLabel.textContent = `${workingOverlayOpacity}%`;
		cursorNameEl.textContent = workingCursorSrc ? "Custom cursor set" : "";
		cursorClearBtn.style.display = workingCursorSrc ? "" : "none";
		cursorScaleRow.style.display = workingCursorSrc ? "flex" : "none";
		cursorScaleInput.value = String(workingCursorScale);
		cursorScaleLabel.textContent = `${workingCursorScale}px`;
		const hasIconColor = !!workingIconColor;
		iconAutoCheck.checked = !hasIconColor;
		iconColorRow.style.display = hasIconColor ? "" : "none";
		if (hasIconColor) {
			iconPicker.value = workingIconColor;
			iconHex.value = workingIconColor;
		}
		for (const key of Object.keys(COLOR_TOKENS)) {
			const derived = getTokenDerivedValue(key);
			const override = workingColorTokens[key];
			const display = override ?? derived;
			const picker = sidebar.querySelector<HTMLInputElement>(
				`#kiln-te-token-${key}-picker`,
			);
			const hexInput = sidebar.querySelector<HTMLInputElement>(
				`#kiln-te-token-${key}-hex`,
			);
			const clearBtn = sidebar.querySelector<HTMLButtonElement>(
				`#kiln-te-token-${key}-clear`,
			);
			if (picker) picker.value = display;
			if (hexInput) hexInput.value = display;
			if (clearBtn) clearBtn.style.display = override ? "" : "none";
		}
		imageStatus.textContent = "";
		renderEffectsList();
		closeAddEffectForm();
	}

	function updateNameUI() {
		const canRename = isCustomTheme() || isNew();
		const savedTheme = getCurrentSavedTheme();
		if (savedTheme) {
			publishedBadge.style.display = "";
			if (savedTheme.importedSlug) {
				publishedBadge.textContent = "Imported";
				publishedBadge.className = "badge mb-2 w-100 bg-info text-dark";
			} else {
				publishedBadge.textContent = savedTheme.publishedSlug
					? "Published"
					: "Unpublished";
				publishedBadge.className = `badge mb-2 w-100 ${savedTheme.publishedSlug ? "bg-primary" : "bg-secondary"}`;
			}
		} else if (isNew()) {
			publishedBadge.style.display = "";
			publishedBadge.textContent = "Unsaved";
			publishedBadge.className = "badge mb-2 w-100 bg-warning text-dark";
		} else if (currentId.startsWith("__preset__:")) {
			publishedBadge.style.display = "";
			publishedBadge.textContent = "Preset (edit to make a copy)";
			publishedBadge.className = "badge mb-2 w-100 bg-secondary";
		} else {
			publishedBadge.style.display = "none";
		}
		namePencil.style.display = canRename ? "" : "none";
	}

	function refreshLeftActions() {
		publishStatus.innerHTML = "";
		leftActions.innerHTML = "";
		const savedTheme = getCurrentSavedTheme();

		if (!isNew()) {
			const newBtn = document.createElement("button");
			newBtn.className = "btn btn-sm btn-outline-primary flex-fill";
			newBtn.innerHTML = '<i class="fas fa-plus me-1"></i>New';
			leftActions.appendChild(newBtn);
			newBtn.addEventListener("click", () => switchTheme("__new__"));
		}

		if (savedTheme) {
			const deleteBtn = document.createElement("button");
			deleteBtn.className = "btn btn-sm btn-outline-danger flex-fill";
			deleteBtn.innerHTML = '<i class="fas fa-trash me-1"></i>Delete';
			leftActions.appendChild(deleteBtn);
			deleteBtn.addEventListener("click", () => {
				openDeleteOverlay(savedTheme);
			});

			if (!savedTheme.importedSlug && savedTheme.publishedSlug) {
				const unpublishBtn = document.createElement("button");
				unpublishBtn.className = "btn btn-sm btn-outline-warning flex-fill";
				unpublishBtn.innerHTML =
					'<i class="fas fa-cloud-arrow-down me-1"></i>Unpublish';
				leftActions.appendChild(unpublishBtn);
				unpublishBtn.addEventListener("click", async () => {
					const sessions = await apiSessions.getValue();
					const verified =
						sessions.find((s) => s.state === "verified" && s.accessToken) ??
						(await showVerificationModal());
					if (!verified) return;
					unpublishBtn.disabled = true;
					publishStatus.textContent = "Unpublishing…";
					const result = await sendMessage("unpublishTheme", {
						userId: verified.userId,
						id: savedTheme.publishedSlug!,
					});
					if (result.ok) {
						const current = await _savedThemes.getValue();
						const idx = current.findIndex((t) => t.id === savedTheme.id);
						if (idx >= 0) {
							const { publishedSlug, ...rest } = current[idx];
							current[idx] = { ...rest, previousPublishedSlug: publishedSlug };
							await _savedThemes.setValue(current);
						}
						savedThemes = await _savedThemes.getValue();
						publishStatus.innerHTML =
							'<span class="text-success"><i class="fas fa-check me-1"></i>Unpublished.</span>';
						buildSelect();
						updateNameUI();
						refreshLeftActions();
					} else {
						publishStatus.textContent = friendlyApiError(
							result.message,
							"Failed to unpublish. Please try again.",
						);
						unpublishBtn.disabled = false;
					}
				});
			} else if (!savedTheme.importedSlug) {
				const publishBtn = document.createElement("button");
				publishBtn.className = "btn btn-sm btn-outline-secondary flex-fill";
				publishBtn.innerHTML = '<i class="fas fa-upload me-1"></i>Publish';
				leftActions.appendChild(publishBtn);
				publishBtn.addEventListener("click", async () => {
					const sessions = await apiSessions.getValue();
					const verified =
						sessions.find((s) => s.state === "verified" && s.accessToken) ??
						(await showVerificationModal());
					if (!verified) return;
					const publishedCount = savedThemes.filter(
						(t) => t.publishedSlug,
					).length;
					const cfg = await getConfig();
					if (publishedCount >= cfg.limits.maxPublishedThemes) {
						publishStatus.textContent = `You can only publish up to ${cfg.limits.maxPublishedThemes} theme${cfg.limits.maxPublishedThemes === 1 ? "" : "s"}.`;
						return;
					}
					const name = workingName || "My Theme";
					publishBtn.disabled = true;
					publishStatus.textContent = "Publishing…";
					const result = await sendMessage("publishTheme", {
						userId: verified.userId,
						name,
						accentColor: workingAccent,
						navbarColor: workingNavbar,
						...(workingFont !== "default" ? { fontFamily: workingFont } : {}),
						...(workingCss ? { customCss: workingCss } : {}),
						...(workingBg ? { backgroundImage: workingBg } : {}),
						...(workingEffects.length ? { effects: workingEffects } : {}),
						...(workingIconColor ? { navbarIconColor: workingIconColor } : {}),
						...(Object.keys(workingColorTokens).length
							? { colorTokens: workingColorTokens }
							: {}),
						...(savedTheme.previousPublishedSlug
							? { existingId: savedTheme.previousPublishedSlug }
							: {}),
					});
					if (result.ok) {
						const publishedId = result.data.data.id;
						const isPending = result.data.data.approvalStatus === "pending";
						publishStatus.innerHTML = isPending
							? `<div><span class="text-warning"><i class="fas fa-clock me-1"></i>Submitted for review</span><code class="ms-2" style="font-size:0.8em;">${publishedId}</code><button class="btn btn-sm btn-outline-secondary py-0 ms-1" id="kiln-te-copy-id"><i class="fas fa-copy me-1"></i>Copy ID</button></div><div class="text-muted small mt-1">Your theme includes content that must be approved before others can import it.</div>`
							: `<span class="text-success me-2"><i class="fas fa-check me-1"></i>Published!</span><code class="me-2" style="font-size:0.8em;">${publishedId}</code><button class="btn btn-sm btn-outline-secondary py-0" id="kiln-te-copy-id"><i class="fas fa-copy me-1"></i>Copy ID</button>`;
						publishStatus
							.querySelector("#kiln-te-copy-id")!
							.addEventListener("click", () => {
								navigator.clipboard.writeText(publishedId);
								const btn =
									publishStatus.querySelector<HTMLButtonElement>(
										"#kiln-te-copy-id",
									)!;
								btn.innerHTML = '<i class="fas fa-check me-1"></i>Copied!';
								setTimeout(() => {
									btn.innerHTML = '<i class="fas fa-copy me-1"></i>Copy ID';
								}, 2000);
							});
						const current = await _savedThemes.getValue();
						const idx = current.findIndex((t) => t.id === savedTheme.id);
						if (idx >= 0) {
							const { previousPublishedSlug: _, ...rest } = current[idx];
							current[idx] = { ...rest, publishedSlug: publishedId };
							await _savedThemes.setValue(current);
							savedThemes = await _savedThemes.getValue();
						}
						buildSelect();
						updateNameUI();
						refreshLeftActions();
					} else {
						publishStatus.textContent = result.message.includes("409")
							? "A theme with that name already exists."
							: result.message.includes("403")
								? "You've reached your publish limit."
								: friendlyApiError(
										result.message,
										"Failed to publish. Please try again.",
									);
					}
					publishBtn.disabled = false;
				});
			}
		} else {
			const importBtn = document.createElement("button");
			importBtn.className = "btn btn-sm btn-outline-secondary flex-fill";
			importBtn.innerHTML = '<i class="fas fa-download me-1"></i>Import';
			leftActions.appendChild(importBtn);
			importBtn.addEventListener("click", () => showImportFlow());

			const galleryBtn = document.createElement("button");
			galleryBtn.className = "btn btn-sm btn-outline-secondary flex-fill";
			galleryBtn.innerHTML = '<i class="fas fa-store me-1"></i>Gallery';
			leftActions.appendChild(galleryBtn);
			galleryBtn.addEventListener("click", () => showGalleryFlow());
		}
	}

	function switchTheme(id: string) {
		applyIdToState(id);
		buildSelect();
		syncInputsToState();
		updateNameUI();
		refreshLeftActions();
		void applyScaledCursor();
	}

	async function applyScaledCursor() {
		if (!workingCursorSrc) {
			workingCursor = "";
			refreshPreview();
			return;
		}
		const img = new Image();
		img.src = workingCursorSrc;
		await new Promise<void>((r) => {
			if (img.complete) {
				r();
				return;
			}
			img.onload = () => r();
			img.onerror = () => r();
		});
		const canvas = document.createElement("canvas");
		canvas.width = workingCursorScale;
		canvas.height = workingCursorScale;
		canvas
			.getContext("2d")!
			.drawImage(img, 0, 0, workingCursorScale, workingCursorScale);
		workingCursor = canvas.toDataURL("image/png");
		refreshPreview();
	}

	async function clonePresetIfNeeded() {
		if (!currentId.startsWith("__preset__:")) return;
		const themeId = crypto.randomUUID();
		const current = await _savedThemes.getValue();
		current.push({
			id: themeId,
			name: workingName,
			accentColor: workingAccent,
			navbarColor: workingNavbar,
			fontFamily: workingFont !== "default" ? workingFont : undefined,
			customCss: workingCss || undefined,
			backgroundImage: workingBg || undefined,
			backgroundOverlayColor:
				workingOverlayOpacity > 0 ? workingOverlayColor : undefined,
			backgroundOverlayOpacity:
				workingOverlayOpacity > 0 ? workingOverlayOpacity : undefined,
			effects: workingEffects.length > 0 ? workingEffects : undefined,
			navbarIconColor: workingIconColor || undefined,
			cursorUrl: workingCursorSrc || undefined,
			cursorScale: workingCursorSrc ? workingCursorScale : undefined,
			colorTokens:
				Object.keys(workingColorTokens).length > 0
					? workingColorTokens
					: undefined,
		});
		await _savedThemes.setValue(current);
		savedThemes = current;
		currentId = themeId;
		buildSelect();
		updateNameUI();
		refreshLeftActions();
	}

	const renameOverlay = sidebar.querySelector<HTMLElement>(
		"#kiln-te-rename-overlay",
	)!;
	const renameInput = sidebar.querySelector<HTMLInputElement>(
		"#kiln-te-rename-input",
	)!;

	function openRenameOverlay() {
		renameInput.value = workingName;
		renameOverlay.style.display = "flex";
		renameInput.focus();
		renameInput.select();
	}
	function closeRenameOverlay() {
		renameOverlay.style.display = "none";
	}
	function confirmRename() {
		const typed = renameInput.value.trim();
		if (typed) {
			workingName = typed;
			const opt = themeSelect.querySelector<HTMLOptionElement>(
				`option[value="${currentId}"]`,
			);
			if (opt) opt.textContent = typed;
		}
		closeRenameOverlay();
	}

	namePencil.addEventListener("click", () => {
		if (!isCustomTheme() && !isNew()) return;
		openRenameOverlay();
	});
	sidebar
		.querySelector("#kiln-te-rename-cancel")!
		.addEventListener("click", closeRenameOverlay);
	sidebar
		.querySelector("#kiln-te-rename-confirm")!
		.addEventListener("click", confirmRename);
	renameInput.addEventListener("keydown", (e) => {
		if (e.key === "Enter") confirmRename();
		if (e.key === "Escape") closeRenameOverlay();
	});

	const importOverlay = sidebar.querySelector<HTMLElement>(
		"#kiln-te-import-overlay",
	)!;
	const importInput = sidebar.querySelector<HTMLInputElement>(
		"#kiln-te-import-input",
	)!;
	const importStatus = sidebar.querySelector<HTMLElement>(
		"#kiln-te-import-status",
	)!;
	const importLoadBtn = sidebar.querySelector<HTMLButtonElement>(
		"#kiln-te-import-load",
	)!;

	function openImportOverlay() {
		importInput.value = "";
		importStatus.textContent = "";
		importStatus.className = "small mb-2";
		importLoadBtn.disabled = false;
		importOverlay.style.display = "flex";
		importInput.focus();
	}
	function closeImportOverlay() {
		importOverlay.style.display = "none";
	}

	sidebar
		.querySelector("#kiln-te-import-cancel")!
		.addEventListener("click", closeImportOverlay);
	importInput.addEventListener("keydown", (e) => {
		if (e.key === "Escape") closeImportOverlay();
	});
	importLoadBtn.addEventListener("click", async () => {
		const raw = importInput.value.trim();
		if (!raw) return;
		const id = raw.split("/").pop()!;
		importLoadBtn.disabled = true;
		importStatus.textContent = "Loading…";
		importStatus.className = "small text-muted mb-2";

		const result = await sendMessage("getPublishedTheme", id);
		if (!result.ok) {
			importStatus.textContent = result.message.includes("404")
				? "Theme not found."
				: friendlyApiError(
						result.message,
						"Failed to import theme. Please try again.",
					);
			importStatus.className = "small text-danger mb-2";
			importLoadBtn.disabled = false;
			return;
		}

		const fetched = result.data.data;
		const userResult = await sendMessage("getUser", fetched.userId);
		const creatorName = userResult.ok
			? userResult.data.username
			: `User #${fetched.userId}`;

		closeImportOverlay();
		await showConfirmImport(fetched, creatorName);
		importLoadBtn.disabled = false;
	});

	const deleteOverlay = sidebar.querySelector<HTMLElement>(
		"#kiln-te-delete-overlay",
	)!;
	const deleteMessage = sidebar.querySelector<HTMLElement>(
		"#kiln-te-delete-message",
	)!;
	const deleteConfirmBtn = sidebar.querySelector<HTMLButtonElement>(
		"#kiln-te-delete-confirm",
	)!;
	let themeToDelete: NonNullable<
		ReturnType<typeof getCurrentSavedTheme>
	> | null = null;

	function openDeleteOverlay(
		savedTheme: NonNullable<ReturnType<typeof getCurrentSavedTheme>>,
	) {
		themeToDelete = savedTheme;
		deleteMessage.textContent = `Are you sure you want to delete "${savedTheme.name}"? This cannot be undone.`;
		deleteOverlay.style.display = "flex";
	}
	function closeDeleteOverlay() {
		deleteOverlay.style.display = "none";
		themeToDelete = null;
	}

	sidebar
		.querySelector("#kiln-te-delete-cancel")!
		.addEventListener("click", closeDeleteOverlay);
	deleteConfirmBtn.addEventListener("click", async () => {
		const savedTheme = themeToDelete;
		if (!savedTheme) return;

		const apiSlug =
			savedTheme.publishedSlug ?? savedTheme.previousPublishedSlug;
		if (apiSlug) {
			const sessions = await apiSessions.getValue();
			const verified = sessions.find(
				(s) => s.state === "verified" && s.accessToken,
			);
			if (verified) {
				await sendMessage("deletePublishedTheme", {
					userId: verified.userId,
					id: apiSlug,
				});
			}
		}
		const current = await _savedThemes.getValue();
		await _savedThemes.setValue(current.filter((t) => t.id !== savedTheme.id));
		const activeId = (values.config.themeCreator as any).activeThemeId;
		if (activeId === savedTheme.id) {
			(values.config as any).themeCreator = { activeThemeId: "default" };
			await preferences.setValue(values);
			applyKilnTheme(null);
		}
		savedThemes = await _savedThemes.getValue();
		applyIdToState("__default__");
		buildSelect();
		syncInputsToState();
		updateNameUI();
		refreshLeftActions();
		refreshPreview();

		closeDeleteOverlay();
	});

	themeSelect.addEventListener("change", () => switchTheme(themeSelect.value));

	accentPicker.addEventListener("input", async () => {
		await clonePresetIfNeeded();
		workingAccent = accentPicker.value;
		accentHex.value = workingAccent;
		refreshPreview();
	});
	accentHex.addEventListener("change", async () => {
		const v = accentHex.value.startsWith("#")
			? accentHex.value
			: `#${accentHex.value}`;
		if (!isValidHex(v)) {
			accentHex.value = workingAccent;
			return;
		}
		await clonePresetIfNeeded();
		workingAccent = v;
		accentPicker.value = v;
		refreshPreview();
	});
	navbarPicker.addEventListener("input", async () => {
		await clonePresetIfNeeded();
		workingNavbar = navbarPicker.value;
		navbarHex.value = workingNavbar;
		refreshPreview();
	});
	navbarHex.addEventListener("change", async () => {
		const v = navbarHex.value.startsWith("#")
			? navbarHex.value
			: `#${navbarHex.value}`;
		if (!isValidHex(v)) {
			navbarHex.value = workingNavbar;
			return;
		}
		await clonePresetIfNeeded();
		workingNavbar = v;
		navbarPicker.value = v;
		refreshPreview();
	});
	fontSelect.addEventListener("change", async () => {
		await clonePresetIfNeeded();
		workingFont = fontSelect.value;
		refreshPreview();
	});
	cssTextarea.addEventListener("input", async () => {
		await clonePresetIfNeeded();
		workingCss = cssTextarea.value;
		refreshPreview();
	});
	bgSetBtn.addEventListener("click", async () => {
		const url = bgUrlInput.value.trim();
		await clonePresetIfNeeded();
		workingBg = url;
		bgClearBtn.style.display = url ? "" : "none";
		bgOverlayRow.style.display = url ? "" : "none";
		refreshPreview();
	});
	bgUrlInput.addEventListener("keydown", (e) => {
		if (e.key === "Enter") bgSetBtn.click();
	});
	bgClearBtn.addEventListener("click", async () => {
		await clonePresetIfNeeded();
		workingBg = "";
		bgUrlInput.value = "";
		bgClearBtn.style.display = "none";
		bgOverlayRow.style.display = "none";
		refreshPreview();
	});
	cursorFileInput.addEventListener("change", async () => {
		const file = cursorFileInput.files?.[0];
		if (!file) return;
		cursorFileInput.value = "";
		await clonePresetIfNeeded();
		const bitmap = await createImageBitmap(file);
		const srcCanvas = document.createElement("canvas");
		srcCanvas.width = 128;
		srcCanvas.height = 128;
		srcCanvas.getContext("2d")!.drawImage(bitmap, 0, 0, 128, 128);
		bitmap.close();
		workingCursorSrc = srcCanvas.toDataURL("image/png");
		cursorNameEl.textContent = file.name;
		cursorClearBtn.style.display = "";
		cursorScaleRow.style.display = "flex";
		await applyScaledCursor();
	});
	cursorScaleInput.addEventListener("input", async () => {
		workingCursorScale = Number(cursorScaleInput.value);
		cursorScaleLabel.textContent = `${workingCursorScale}px`;
		await clonePresetIfNeeded();
		await applyScaledCursor();
	});
	cursorClearBtn.addEventListener("click", async () => {
		await clonePresetIfNeeded();
		workingCursorSrc = "";
		workingCursorScale = 32;
		workingCursor = "";
		cursorNameEl.textContent = "";
		cursorClearBtn.style.display = "none";
		cursorScaleRow.style.display = "none";
		refreshPreview();
	});
	bgOverlayColor.addEventListener("input", async () => {
		await clonePresetIfNeeded();
		workingOverlayColor = bgOverlayColor.value;
		refreshPreview();
	});
	bgOverlayOpacity.addEventListener("input", async () => {
		await clonePresetIfNeeded();
		workingOverlayOpacity = Number(bgOverlayOpacity.value);
		bgOverlayLabel.textContent = `${workingOverlayOpacity}%`;
		refreshPreview();
	});
	iconAutoCheck.addEventListener("change", async () => {
		if (iconAutoCheck.checked) {
			await clonePresetIfNeeded();
			workingIconColor = "";
			iconColorRow.style.display = "none";
			refreshPreview();
		} else {
			const initial = workingIconColor || workingAccent;
			workingIconColor = initial;
			iconPicker.value = initial;
			iconHex.value = initial;
			iconColorRow.style.display = "";
			refreshPreview();
		}
	});
	iconPicker.addEventListener("input", async () => {
		await clonePresetIfNeeded();
		workingIconColor = iconPicker.value;
		iconHex.value = workingIconColor;
		refreshPreview();
	});
	iconHex.addEventListener("change", async () => {
		const v = iconHex.value.startsWith("#")
			? iconHex.value
			: `#${iconHex.value}`;
		if (!isValidHex(v)) {
			iconHex.value = workingIconColor;
			return;
		}
		await clonePresetIfNeeded();
		workingIconColor = v;
		iconPicker.value = v;
		refreshPreview();
	});

	for (const key of Object.keys(COLOR_TOKENS)) {
		const pickerEl = sidebar.querySelector<HTMLInputElement>(
			`#kiln-te-token-${key}-picker`,
		)!;
		const hexEl = sidebar.querySelector<HTMLInputElement>(
			`#kiln-te-token-${key}-hex`,
		)!;
		const clearBtnEl = sidebar.querySelector<HTMLButtonElement>(
			`#kiln-te-token-${key}-clear`,
		)!;

		pickerEl.addEventListener("input", async () => {
			await clonePresetIfNeeded();
			workingColorTokens[key] = pickerEl.value;
			hexEl.value = pickerEl.value;
			clearBtnEl.style.display = "";
			refreshPreview();
		});
		hexEl.addEventListener("change", async () => {
			const v = hexEl.value.startsWith("#") ? hexEl.value : `#${hexEl.value}`;
			if (!isValidHex(v)) {
				hexEl.value = workingColorTokens[key] ?? getTokenDerivedValue(key);
				return;
			}
			await clonePresetIfNeeded();
			workingColorTokens[key] = v;
			pickerEl.value = v;
			clearBtnEl.style.display = "";
			refreshPreview();
		});
		clearBtnEl.addEventListener("click", async () => {
			await clonePresetIfNeeded();
			delete workingColorTokens[key];
			const derived = getTokenDerivedValue(key);
			pickerEl.value = derived;
			hexEl.value = derived;
			clearBtnEl.style.display = "none";
			refreshPreview();
		});
	}

	exportJsonBtn.addEventListener("click", () => {
		const data: Record<string, unknown> = {
			name: workingName,
			accentColor: workingAccent,
			navbarColor: workingNavbar,
		};
		if (workingFont !== "default") data.fontFamily = workingFont;
		if (workingCss) data.customCss = workingCss;
		if (workingBg) data.backgroundImage = workingBg;
		if (workingOverlayOpacity > 0) {
			data.backgroundOverlayColor = workingOverlayColor;
			data.backgroundOverlayOpacity = workingOverlayOpacity;
		}
		if (workingEffects.length > 0) data.effects = workingEffects;
		if (workingIconColor) data.navbarIconColor = workingIconColor;
		if (workingCursorSrc) {
			data.cursorUrl = workingCursorSrc;
			data.cursorScale = workingCursorScale;
		}
		if (Object.keys(workingColorTokens).length > 0)
			data.colorTokens = workingColorTokens;
		const blob = new Blob([JSON.stringify(data, null, 2)], {
			type: "application/json",
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${(workingName || "theme").replace(/[^a-z0-9]/gi, "_")}.json`;
		a.click();
		URL.revokeObjectURL(url);
	});

	jsonImportInput.addEventListener("change", async () => {
		const file = jsonImportInput.files?.[0];
		if (!file) return;
		jsonImportInput.value = "";
		try {
			const data = JSON.parse(await file.text());
			if (
				typeof data.accentColor !== "string" ||
				typeof data.navbarColor !== "string"
			) {
				publishStatus.textContent =
					"Invalid theme JSON: missing required color fields.";
				return;
			}
			currentId = "__new__";
			workingName =
				typeof data.name === "string" ? data.name : generateRandomThemeName();
			workingAccent = isValidHex(data.accentColor)
				? data.accentColor
				: "#3bafff";
			workingNavbar = isValidHex(data.navbarColor)
				? data.navbarColor
				: "#1a1a1a";
			workingFont =
				typeof data.fontFamily === "string" ? data.fontFamily : "default";
			workingCss = typeof data.customCss === "string" ? data.customCss : "";
			workingBg =
				typeof data.backgroundImage === "string" ? data.backgroundImage : "";
			workingOverlayColor =
				typeof data.backgroundOverlayColor === "string"
					? data.backgroundOverlayColor
					: "#000000";
			workingOverlayOpacity =
				typeof data.backgroundOverlayOpacity === "number"
					? data.backgroundOverlayOpacity
					: 0;
			workingEffects = Array.isArray(data.effects) ? data.effects : [];
			workingIconColor =
				typeof data.navbarIconColor === "string" ? data.navbarIconColor : "";
			workingCursorSrc =
				typeof data.cursorUrl === "string" ? data.cursorUrl : "";
			workingCursorScale =
				typeof data.cursorScale === "number" ? data.cursorScale : 32;
			workingCursor = "";
			workingColorTokens =
				data.colorTokens &&
				typeof data.colorTokens === "object" &&
				!Array.isArray(data.colorTokens)
					? { ...data.colorTokens }
					: {};
			buildSelect();
			syncInputsToState();
			updateNameUI();
			refreshLeftActions();
			await applyScaledCursor();
		} catch {
			publishStatus.textContent = "Failed to parse JSON file.";
		}
	});

	imageInput.addEventListener("change", async () => {
		const file = imageInput.files?.[0];
		if (!file) return;
		imageStatus.textContent = "Extracting…";
		const url = URL.createObjectURL(file);
		const color = await extractDominantColor(url);
		URL.revokeObjectURL(url);
		await clonePresetIfNeeded();
		workingAccent = color;
		accentPicker.value = color;
		accentHex.value = color;
		refreshPreview();
		imageStatus.textContent = `Extracted: ${color}`;
	});
	imageUrlBtn.addEventListener("click", async () => {
		const url = imageUrlInput.value.trim();
		if (!url) return;
		imageStatus.textContent = "Extracting…";
		imageUrlBtn.disabled = true;
		try {
			const color = await extractDominantColor(url);
			await clonePresetIfNeeded();
			workingAccent = color;
			accentPicker.value = color;
			accentHex.value = color;
			refreshPreview();
			imageStatus.textContent = `Extracted: ${color}`;
		} catch {
			imageStatus.textContent =
				"Failed to load image. Try downloading it first.";
		}
		imageUrlBtn.disabled = false;
	});

	saveBtn.addEventListener("click", async () => {
		if (currentId === "__default__") {
			(values.config as any).themeCreator = { activeThemeId: "default" };
			await preferences.setValue(values);
			applyKilnTheme(null);
			appliedOnce = true;
		} else if (currentId.startsWith("__preset__:")) {
			const key = currentId.slice(11);
			(values.config as any).themeCreator = { activeThemeId: key };
			await preferences.setValue(values);
			applyKilnTheme(THEME_PRESETS[key]);
			appliedOnce = true;
		} else {
			const name = workingName || "My Theme";
			const current = await _savedThemes.getValue();
			let themeId: string;
			if (isNew()) {
				themeId = crypto.randomUUID();
				current.push({
					id: themeId,
					name,
					accentColor: workingAccent,
					navbarColor: workingNavbar,
					fontFamily: workingFont !== "default" ? workingFont : undefined,
					customCss: workingCss || undefined,
					backgroundImage: workingBg || undefined,
					backgroundOverlayColor:
						workingOverlayOpacity > 0 ? workingOverlayColor : undefined,
					backgroundOverlayOpacity:
						workingOverlayOpacity > 0 ? workingOverlayOpacity : undefined,
					effects: workingEffects.length > 0 ? workingEffects : undefined,
					navbarIconColor: workingIconColor || undefined,
					cursorUrl: workingCursorSrc || undefined,
					cursorScale: workingCursorSrc ? workingCursorScale : undefined,
					colorTokens:
						Object.keys(workingColorTokens).length > 0
							? workingColorTokens
							: undefined,
				});
			} else {
				themeId = currentId;
				const idx = current.findIndex((t) => t.id === themeId);
				if (idx >= 0)
					current[idx] = {
						...current[idx],
						name,
						accentColor: workingAccent,
						navbarColor: workingNavbar,
						fontFamily: workingFont !== "default" ? workingFont : undefined,
						customCss: workingCss || undefined,
						backgroundImage: workingBg || undefined,
						backgroundOverlayColor:
							workingOverlayOpacity > 0 ? workingOverlayColor : undefined,
						backgroundOverlayOpacity:
							workingOverlayOpacity > 0 ? workingOverlayOpacity : undefined,
						effects: workingEffects.length > 0 ? workingEffects : undefined,
						navbarIconColor: workingIconColor || undefined,
						cursorUrl: workingCursorSrc || undefined,
						cursorScale: workingCursorSrc ? workingCursorScale : undefined,
						colorTokens:
							Object.keys(workingColorTokens).length > 0
								? workingColorTokens
								: undefined,
					};
			}
			await _savedThemes.setValue(current);
			(values.config as any).themeCreator = { activeThemeId: themeId };
			await preferences.setValue(values);
			applyKilnTheme({
				accentColor: workingAccent,
				navbarColor: workingNavbar,
				fontFamily: workingFont,
				customCss: workingCss,
				backgroundImage: workingBg,
				backgroundOverlayColor: workingOverlayColor,
				backgroundOverlayOpacity: workingOverlayOpacity,
				effects: workingEffects,
				navbarIconColor: workingIconColor || undefined,
				cursorUrl: workingCursor || undefined,
				colorTokens:
					Object.keys(workingColorTokens).length > 0
						? workingColorTokens
						: undefined,
			});
			appliedOnce = true;

			const publishedSlug = isNew()
				? null
				: (current.find((t) => t.id === themeId)?.publishedSlug ?? null);

			if (isNew()) {
				savedThemes = await _savedThemes.getValue();
				currentId = themeId;
				workingName = name;
				buildSelect();
				updateNameUI();
				refreshLeftActions();
			} else {
				savedThemes = await _savedThemes.getValue();
				buildSelect();
			}

			if (publishedSlug) {
				const sessions = await apiSessions.getValue();
				const verified = sessions.find(
					(s) => s.state === "verified" && s.accessToken,
				);
				if (verified) {
					publishStatus.textContent = "Syncing published version…";
					const result = await sendMessage("publishTheme", {
						userId: verified.userId,
						name,
						accentColor: workingAccent,
						navbarColor: workingNavbar,
						...(workingFont !== "default" ? { fontFamily: workingFont } : {}),
						...(workingCss ? { customCss: workingCss } : {}),
						...(workingBg ? { backgroundImage: workingBg } : {}),
						...(workingEffects.length ? { effects: workingEffects } : {}),
						...(workingIconColor ? { navbarIconColor: workingIconColor } : {}),
						...(Object.keys(workingColorTokens).length
							? { colorTokens: workingColorTokens }
							: {}),
						existingId: publishedSlug,
					});
					if (result.ok) {
						const isPending = result.data.data.approvalStatus === "pending";
						publishStatus.innerHTML = isPending
							? `<span class="text-warning"><i class="fas fa-clock me-1"></i>Submitted for re-review</span><div class="text-muted small mt-1">Changes to CSS or background require approval before going live.</div>`
							: `<span class="text-success"><i class="fas fa-check me-1"></i>Published version updated!</span>`;
					} else {
						publishStatus.textContent = friendlyApiError(
							result.message,
							"Failed to sync published version. Please try again.",
						);
					}
				}
			}
		}

		const origHtml = saveBtn.innerHTML;
		saveBtn.innerHTML = '<i class="fas fa-check me-1"></i>Applied!';
		saveBtn.disabled = true;
		setTimeout(() => {
			saveBtn.innerHTML = origHtml;
			saveBtn.disabled = false;
		}, 1500);
	});

	sidebar
		.querySelector<HTMLButtonElement>("#kiln-te-close")!
		.addEventListener("click", closeSidebar);

	async function showConfirmImport(
		fetched: {
			id: string;
			userId: number;
			name: string;
			accentColor: string;
			navbarColor: string;
			fontFamily?: string | null;
			customCss?: string | null;
			backgroundImage?: string | null;
			effects?: ThemeEffect[] | null;
			navbarIconColor?: string | null;
			cursorUrl?: string | null;
			cursorScale?: number | null;
		},
		creatorName: string,
	) {
		const confirmModal = createModal();
		confirmModal.innerHTML = `
			<div class="d-flex justify-content-between align-items-center mb-3">
				<h5 class="mb-0 fw-bold">Import Theme</h5>
				<button class="btn-close btn-close-white" id="kiln-confirm-close" aria-label="Close"></button>
			</div>
			<div class="mb-3 d-flex align-items-center gap-3">
				<div style="width:56px;height:56px;border-radius:8px;flex-shrink:0;overflow:hidden;">
					<div style="width:100%;height:50%;background:${fetched.navbarColor};"></div>
					<div style="width:100%;height:50%;background:${fetched.accentColor};"></div>
				</div>
				<div>
					<div class="fw-semibold">${fetched.name}</div>
					<div class="text-muted small">by ${creatorName}</div>
				</div>
			</div>
			<div class="d-flex gap-2 justify-content-end">
				<button class="btn btn-sm btn-secondary" id="kiln-confirm-cancel">Cancel</button>
				<button class="btn btn-sm btn-primary" id="kiln-confirm-import">
					<i class="fas fa-download me-1"></i>Import
				</button>
			</div>
		`;

		confirmModal
			.querySelector("#kiln-confirm-close")!
			.addEventListener("click", () => confirmModal.close());
		confirmModal
			.querySelector("#kiln-confirm-cancel")!
			.addEventListener("click", () => confirmModal.close());

		confirmModal
			.querySelector<HTMLButtonElement>("#kiln-confirm-import")!
			.addEventListener("click", async () => {
				const current = await _savedThemes.getValue();
				const alreadyImported = current.find(
					(t) => t.importedSlug === fetched.id,
				);
				const localId = alreadyImported?.id ?? crypto.randomUUID();

				if (!alreadyImported) {
					current.push({
						id: localId,
						name: fetched.name,
						accentColor: fetched.accentColor,
						navbarColor: fetched.navbarColor,
						fontFamily: fetched.fontFamily ?? undefined,
						customCss: fetched.customCss ?? undefined,
						backgroundImage: fetched.backgroundImage ?? undefined,
						effects: fetched.effects?.length ? fetched.effects : undefined,
						navbarIconColor: fetched.navbarIconColor ?? undefined,
						cursorUrl: fetched.cursorUrl ?? undefined,
						cursorScale: fetched.cursorScale ?? undefined,
						importedSlug: fetched.id,
					});
					await _savedThemes.setValue(current);
				}

				(values.config as any).themeCreator = { activeThemeId: localId };
				await preferences.setValue(values);
				applyKilnTheme({
					accentColor: fetched.accentColor,
					navbarColor: fetched.navbarColor,
					fontFamily: fetched.fontFamily ?? undefined,
					customCss: fetched.customCss ?? undefined,
					backgroundImage: fetched.backgroundImage ?? undefined,
					effects: fetched.effects ?? undefined,
					navbarIconColor: fetched.navbarIconColor ?? undefined,
					cursorUrl: fetched.cursorUrl ?? undefined,
				});
				appliedOnce = true;

				confirmModal.close();
				savedThemes = await _savedThemes.getValue();
				switchTheme(localId);
			});

		confirmModal.showModal();
	}

	function showVerificationModal(): Promise<{
		userId: number;
		accessToken: string;
	} | null> {
		window.open("https://polytoria.com/my/settings/kiln?tab=sync", "_blank");
		publishStatus.innerHTML =
			'<span class="text-info"><i class="fas fa-external-link-alt me-1"></i>Connect your account in the opened tab, then try again.</span>';
		return Promise.resolve(null);
	}

	function showGalleryFlow() {
		let galleryPage = 1;
		let galleryTotalPages = 1;

		const galleryModal = createModal("lg");

		function renderGalleryShell() {
			galleryModal.innerHTML = `
				<div class="d-flex justify-content-between align-items-center mb-3">
					<h5 class="mb-0 fw-bold">Theme Gallery</h5>
					<button class="btn-close btn-close-white" id="kiln-gallery-close" aria-label="Close"></button>
				</div>
				<div id="kiln-gallery-body"></div>
				<div class="d-flex justify-content-between align-items-center mt-3">
					<button class="btn btn-sm btn-outline-secondary" id="kiln-gallery-prev" disabled>‹ Prev</button>
					<span id="kiln-gallery-page" class="small text-muted"></span>
					<button class="btn btn-sm btn-outline-secondary" id="kiln-gallery-next" disabled>Next ›</button>
				</div>
			`;
			galleryModal
				.querySelector("#kiln-gallery-close")!
				.addEventListener("click", () => galleryModal.close());
			galleryModal
				.querySelector("#kiln-gallery-prev")!
				.addEventListener("click", () => {
					if (galleryPage > 1) loadGalleryPage(galleryPage - 1);
				});
			galleryModal
				.querySelector("#kiln-gallery-next")!
				.addEventListener("click", () => {
					if (galleryPage < galleryTotalPages) loadGalleryPage(galleryPage + 1);
				});
		}

		async function loadGalleryPage(page: number) {
			const body =
				galleryModal.querySelector<HTMLElement>("#kiln-gallery-body")!;
			const prevBtn =
				galleryModal.querySelector<HTMLButtonElement>("#kiln-gallery-prev")!;
			const nextBtn =
				galleryModal.querySelector<HTMLButtonElement>("#kiln-gallery-next")!;
			const pageLabel =
				galleryModal.querySelector<HTMLElement>("#kiln-gallery-page")!;

			body.innerHTML = `<p class="text-muted small text-center py-4">Loading…</p>`;
			prevBtn.disabled = true;
			nextBtn.disabled = true;

			const result = await sendMessage("getThemeGallery", page);
			if (!result.ok) {
				body.innerHTML = `<p class="text-danger small text-center py-4">Failed to load gallery.</p>`;
				return;
			}

			galleryPage = result.data.meta.currentPage;
			galleryTotalPages = result.data.meta.totalPages;
			pageLabel.textContent = `Page ${galleryPage} of ${galleryTotalPages}`;
			prevBtn.disabled = galleryPage <= 1;
			nextBtn.disabled = galleryPage >= galleryTotalPages;

			const themes = result.data.data;
			if (themes.length === 0) {
				body.innerHTML = `<p class="text-muted small text-center py-4">No themes yet.</p>`;
				return;
			}

			const uniqueUserIds = [...new Set(themes.map((t) => t.userId))];
			const userResults = await Promise.all(
				uniqueUserIds.map((id) => sendMessage("getUser", id)),
			);
			const usernameMap: Record<number, string> = {};
			for (let i = 0; i < uniqueUserIds.length; i++) {
				const r = userResults[i];
				usernameMap[uniqueUserIds[i]] = r.ok
					? r.data.username
					: `User #${uniqueUserIds[i]}`;
			}

			body.innerHTML = `<div class="row g-2" id="kiln-gallery-grid"></div>`;
			const grid = body.querySelector("#kiln-gallery-grid")!;
			for (const theme of themes) {
				const creatorName = usernameMap[theme.userId];
				const col = document.createElement("div");
				col.className = "col-6 col-md-4 col-lg-3";
				col.innerHTML = `
					<div class="card h-100" style="cursor:pointer;" data-theme-id="${theme.id}">
						<div style="height:48px;display:flex;border-radius:var(--bs-card-border-radius) var(--bs-card-border-radius) 0 0;overflow:hidden;">
							<div style="flex:1;background:${theme.navbarColor};"></div>
							<div style="flex:1;background:${theme.accentColor};"></div>
						</div>
						<div class="card-body py-2 px-2">
							<div class="fw-semibold small text-truncate">${theme.name}</div>
							<div class="d-flex align-items-center justify-content-between">
								<div class="text-muted text-truncate" style="font-size:0.75em;">by ${creatorName}</div>
								<button class="kiln-gallery-report btn btn-link p-0 text-muted" title="Report theme" style="font-size:0.7em;flex-shrink:0;line-height:1;">
									<i class="fas fa-flag"></i>
								</button>
							</div>
						</div>
					</div>
				`;
				col.querySelector(".card")!.addEventListener("click", async (e) => {
					if ((e.target as HTMLElement).closest(".kiln-gallery-report")) return;
					const fetchResult = await sendMessage("getPublishedTheme", theme.id);
					if (!fetchResult.ok) return;
					const fetched = fetchResult.data.data;
					galleryModal.close();
					await showConfirmImport(fetched, creatorName);
				});
				col
					.querySelector(".kiln-gallery-report")!
					.addEventListener("click", (e) => {
						e.stopPropagation();
						const reportModal = createModal();
						reportModal.innerHTML = `
						<div class="d-flex justify-content-between align-items-center mb-3">
							<h5 class="mb-0 fw-bold">Report Theme</h5>
							<button class="btn-close btn-close-white" id="kiln-report-close" aria-label="Close"></button>
						</div>
						<p class="small text-muted mb-2">Describe the issue with <strong>${theme.name}</strong>:</p>
						<textarea id="kiln-report-reason" class="form-control form-control-sm mb-3" rows="3" maxlength="500" placeholder="e.g. hides page content, inappropriate imagery…"></textarea>
						<div id="kiln-report-status" class="small text-danger mb-2" style="min-height:1em;"></div>
						<div class="d-flex gap-2 justify-content-end">
							<button class="btn btn-sm btn-secondary" id="kiln-report-cancel">Cancel</button>
							<button class="btn btn-sm btn-danger" id="kiln-report-submit">
								<i class="fas fa-flag me-1"></i>Report
							</button>
						</div>
					`;
						reportModal
							.querySelector("#kiln-report-close")!
							.addEventListener("click", () => reportModal.close());
						reportModal
							.querySelector("#kiln-report-cancel")!
							.addEventListener("click", () => reportModal.close());
						reportModal
							.querySelector("#kiln-report-submit")!
							.addEventListener("click", async () => {
								const reason = reportModal
									.querySelector<HTMLTextAreaElement>("#kiln-report-reason")!
									.value.trim();
								const status = reportModal.querySelector<HTMLElement>(
									"#kiln-report-status",
								)!;
								const submitBtn = reportModal.querySelector<HTMLButtonElement>(
									"#kiln-report-submit",
								)!;
								if (!reason) {
									status.textContent =
										"Please describe the issue before submitting.";
									return;
								}
								submitBtn.disabled = true;
								const result = await sendMessage("reportTheme", {
									id: theme.id,
									reason,
								});
								if (result.ok) {
									reportModal.innerHTML = `
								<p class="fw-bold mb-1">Report submitted</p>
								<p class="text-muted small mb-3">Thank you — we'll review this theme shortly.</p>
								<div class="d-flex justify-content-end">
									<button class="btn btn-sm btn-secondary" id="kiln-report-done">Close</button>
								</div>
							`;
									reportModal
										.querySelector("#kiln-report-done")!
										.addEventListener("click", () => reportModal.close());
								} else {
									status.textContent =
										"Failed to submit report. Please try again.";
									submitBtn.disabled = false;
								}
							});
						reportModal.showModal();
					});
				grid.appendChild(col);
			}
		}

		renderGalleryShell();
		galleryModal.showModal();
		loadGalleryPage(1);
	}

	function showImportFlow() {
		openImportOverlay();
	}

	const addEffectForm = sidebar.querySelector<HTMLElement>(
		"#kiln-te-add-effect-form",
	)!;
	const addEffectNewBtn = sidebar.querySelector<HTMLButtonElement>(
		"#kiln-te-effect-new",
	)!;
	const effectSlotSelect = sidebar.querySelector<HTMLSelectElement>(
		"#kiln-te-effect-slot",
	)!;
	const effectTypeSelect = sidebar.querySelector<HTMLSelectElement>(
		"#kiln-te-effect-type",
	)!;
	const effectValueRow = sidebar.querySelector<HTMLElement>(
		"#kiln-te-effect-value-row",
	)!;

	for (const [key, slot] of Object.entries(EFFECT_SLOTS))
		effectSlotSelect.add(new Option(slot.label, key));

	function populateEffectTypes() {
		const slot = effectSlotSelect.value as keyof typeof EFFECT_SLOTS;
		const allowed = EFFECT_SLOTS[slot].types;
		effectTypeSelect.innerHTML = "";
		for (const t of allowed)
			effectTypeSelect.add(new Option(EFFECT_TYPE_CONFIGS[t].label, t));
		renderEffectValueInput();
	}

	function renderEffectValueInput() {
		const type = effectTypeSelect.value as keyof typeof EFFECT_TYPE_CONFIGS;
		const cfg = EFFECT_TYPE_CONFIGS[type]?.input;
		if (!cfg) {
			effectValueRow.innerHTML = "";
			return;
		}
		if (cfg.kind === "slider") {
			effectValueRow.innerHTML = `
				<label class="form-label small text-muted mb-1">Value</label>
				<div class="d-flex align-items-center gap-2">
					<input type="range" id="kiln-te-efv-slider" min="${cfg.min}" max="${cfg.max}" step="${cfg.step}" value="${cfg.default}" class="flex-fill" style="min-width:0;" />
					<span id="kiln-te-efv-label" class="small text-muted" style="min-width:3em;text-align:right;">${cfg.default}${cfg.unit}</span>
				</div>`;
			const slider = effectValueRow.querySelector<HTMLInputElement>(
				"#kiln-te-efv-slider",
			)!;
			const label =
				effectValueRow.querySelector<HTMLElement>("#kiln-te-efv-label")!;
			slider.addEventListener("input", () => {
				label.textContent = `${slider.value}${cfg.unit}`;
			});
		} else if (cfg.kind === "select") {
			effectValueRow.innerHTML = `
				<label class="form-label small text-muted mb-1">Value</label>
				<select id="kiln-te-efv-select" class="form-select form-select-sm">
					${cfg.options.map((o) => `<option value="${o.value}"${o.value === cfg.default ? " selected" : ""}>${o.label}</option>`).join("")}
				</select>`;
		} else if (cfg.kind === "url") {
			effectValueRow.innerHTML = `
				<label class="form-label small text-muted mb-1">Frame Image URL</label>
				<input type="text" id="kiln-te-efv-url" class="form-control form-control-sm"
				       placeholder="https://…" value="${cfg.default}" />
				<div class="small text-muted mt-1">Use a PNG with a transparent center. The image will be overlaid on top of the avatar.</div>`;
		} else if (cfg.kind === "color-alpha") {
			const [initHex, initAlpha] = parseColorAlpha(cfg.default);
			effectValueRow.innerHTML = `
				<label class="form-label small text-muted mb-1">Color</label>
				<div class="d-flex align-items-center gap-2 mb-2">
					<input type="color" id="kiln-te-efv-color" class="kiln-te-color-picker" value="${initHex}" />
					<input type="text" id="kiln-te-efv-hex" class="form-control form-control-sm kiln-te-hex-input" maxlength="7" value="${initHex}" />
				</div>
				<div class="d-flex align-items-center gap-2">
					<span class="small text-muted" style="white-space:nowrap;min-width:4.5em;">Opacity</span>
					<input type="range" id="kiln-te-efv-alpha" min="0" max="100" step="1" value="${initAlpha}" class="flex-fill" style="min-width:0;" />
					<span id="kiln-te-efv-alpha-label" class="small text-muted" style="min-width:2.5em;text-align:right;">${initAlpha}%</span>
				</div>`;
			const colorPicker =
				effectValueRow.querySelector<HTMLInputElement>("#kiln-te-efv-color")!;
			const hexInput =
				effectValueRow.querySelector<HTMLInputElement>("#kiln-te-efv-hex")!;
			const alphaSlider =
				effectValueRow.querySelector<HTMLInputElement>("#kiln-te-efv-alpha")!;
			const alphaLabel = effectValueRow.querySelector<HTMLElement>(
				"#kiln-te-efv-alpha-label",
			)!;
			colorPicker.addEventListener("input", () => {
				hexInput.value = colorPicker.value;
			});
			hexInput.addEventListener("change", () => {
				const v = hexInput.value.startsWith("#")
					? hexInput.value
					: `#${hexInput.value}`;
				if (isValidHex(v)) {
					colorPicker.value = v;
					hexInput.value = v;
				} else hexInput.value = colorPicker.value;
			});
			alphaSlider.addEventListener("input", () => {
				alphaLabel.textContent = `${alphaSlider.value}%`;
			});
		} else {
			effectValueRow.innerHTML = `
				<label class="form-label small text-muted mb-1">Value</label>
				<div class="d-flex align-items-center gap-2">
					<input type="color" id="kiln-te-efv-color" class="kiln-te-color-picker" value="${cfg.default}" />
					<input type="text" id="kiln-te-efv-hex" class="form-control form-control-sm kiln-te-hex-input" maxlength="7" value="${cfg.default}" />
				</div>`;
			const colorPicker =
				effectValueRow.querySelector<HTMLInputElement>("#kiln-te-efv-color")!;
			const hexInput =
				effectValueRow.querySelector<HTMLInputElement>("#kiln-te-efv-hex")!;
			colorPicker.addEventListener("input", () => {
				hexInput.value = colorPicker.value;
			});
			hexInput.addEventListener("change", () => {
				const v = hexInput.value.startsWith("#")
					? hexInput.value
					: `#${hexInput.value}`;
				if (isValidHex(v)) {
					colorPicker.value = v;
					hexInput.value = v;
				} else hexInput.value = colorPicker.value;
			});
		}
	}

	function getEffectFormValue(): string | number {
		const type = effectTypeSelect.value as keyof typeof EFFECT_TYPE_CONFIGS;
		const cfg = EFFECT_TYPE_CONFIGS[type]?.input;
		if (!cfg) return "";
		if (cfg.kind === "slider") {
			return Number(
				effectValueRow.querySelector<HTMLInputElement>("#kiln-te-efv-slider")!
					.value,
			);
		} else if (cfg.kind === "select") {
			return effectValueRow.querySelector<HTMLSelectElement>(
				"#kiln-te-efv-select",
			)!.value;
		} else if (cfg.kind === "url") {
			return effectValueRow
				.querySelector<HTMLInputElement>("#kiln-te-efv-url")!
				.value.trim();
		} else if (cfg.kind === "color-alpha") {
			const color =
				effectValueRow.querySelector<HTMLInputElement>(
					"#kiln-te-efv-color",
				)!.value;
			const alpha = Number(
				effectValueRow.querySelector<HTMLInputElement>("#kiln-te-efv-alpha")!
					.value,
			);
			const [r, g, b] = hexToRgb(color);
			return `rgba(${r},${g},${b},${(alpha / 100).toFixed(2)})`;
		} else {
			return effectValueRow.querySelector<HTMLInputElement>(
				"#kiln-te-efv-color",
			)!.value;
		}
	}

	function closeAddEffectForm() {
		addEffectForm.style.display = "none";
		addEffectNewBtn.style.display = "";
	}

	function openAddEffectForm() {
		effectSlotSelect.value = Object.keys(EFFECT_SLOTS)[0];
		populateEffectTypes();
		addEffectForm.style.display = "";
		addEffectNewBtn.style.display = "none";
	}

	addEffectNewBtn.addEventListener("click", openAddEffectForm);
	effectSlotSelect.addEventListener("change", populateEffectTypes);
	effectTypeSelect.addEventListener("change", renderEffectValueInput);

	sidebar
		.querySelector("#kiln-te-effect-cancel")!
		.addEventListener("click", closeAddEffectForm);

	sidebar
		.querySelector("#kiln-te-effect-confirm")!
		.addEventListener("click", async () => {
			await clonePresetIfNeeded();
			const slot = effectSlotSelect.value as keyof typeof EFFECT_SLOTS;
			const type = effectTypeSelect.value as keyof typeof EFFECT_TYPE_CONFIGS;
			const value = getEffectFormValue();
			const existingIdx = workingEffects.findIndex(
				(e) => e.slot === slot && e.type === type,
			);
			const newEffect: ThemeEffect = {
				id:
					existingIdx >= 0
						? workingEffects[existingIdx].id
						: crypto.randomUUID(),
				slot,
				type,
				value,
			};
			if (existingIdx >= 0) workingEffects[existingIdx] = newEffect;
			else workingEffects.push(newEffect);
			renderEffectsList();
			refreshPreview();
			closeAddEffectForm();
		});

	for (const hdr of sidebar.querySelectorAll<HTMLElement>(
		".kiln-te-section-hdr",
	)) {
		hdr.addEventListener("click", () => {
			const body = document.getElementById(hdr.dataset.body!)!;
			const opening = body.style.display === "none";
			body.style.display = opening ? "" : "none";
			hdr.querySelector("i")!.className =
				`fas fa-chevron-${opening ? "up" : "down"}`;
			if (opening) {
				hdr.style.borderRadius = "";
				hdr.style.border = "";
			} else {
				hdr.style.borderRadius = "inherit";
				hdr.style.border = "none";
			}
		});
	}

	buildSelect();
	syncInputsToState();
	updateNameUI();
	refreshLeftActions();
	void applyScaledCursor();

	const savedState = loadTeState();
	if (savedState.isFloating) {
		toggleFloat();
		if (savedState.floatLeft !== undefined)
			sidebar.style.left = `${savedState.floatLeft}px`;
		if (savedState.floatTop !== undefined)
			sidebar.style.top = `${savedState.floatTop}px`;
		if (savedState.width !== undefined)
			sidebar.style.width = `${savedState.width}px`;
		if (savedState.height !== undefined)
			sidebar.style.height = `${savedState.height}px`;
	} else if (savedState.width !== undefined) {
		sidebar.style.width = `${savedState.width}px`;
		document.body.style.marginRight = `${savedState.width}px`;
	}
}
