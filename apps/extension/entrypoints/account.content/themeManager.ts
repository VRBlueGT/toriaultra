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

import {
	_savedThemes,
	type defaultPreferences,
	preferences,
	type SavedTheme,
} from "@/utils/storage";
import { THEME_PRESETS } from "@/utils/theme";
import {
	applyThemeById,
	deleteSavedTheme,
	forkPreset,
	openNewThemeModal,
	openThemeGallery,
} from "@/utils/themeEditorShared";
import { createModal } from "@/utils/utilities";

const EDITOR_URL = "https://polytoria.com/home?kiln-theme-editor";

export function initThemeManager(
	container: HTMLElement,
	values: typeof defaultPreferences,
	initiallyEnabled: boolean,
): { setEnabled: (enabled: boolean) => void } {
	let enabled = initiallyEnabled;
	let saved: SavedTheme[] = [];

	const row = document.createElement("div");
	row.className = "d-flex align-items-center gap-1 mt-2";
	row.style.maxWidth = "560px";
	row.innerHTML = `
		<button type="button" class="btn btn-sm btn-outline-primary flex-shrink-0" data-act="new" title="Create a new theme">
			<i class="fas fa-plus me-1"></i>New
		</button>
		<button type="button" class="btn btn-sm btn-outline-secondary flex-shrink-0" data-act="gallery" title="Browse published themes">
			<i class="fas fa-store me-1"></i>Gallery
		</button>
		<div class="input-group input-group-sm flex-nowrap flex-fill" style="min-width:0;">
			<select class="form-select" style="min-width:0;" aria-label="Active theme"></select>
			<button type="button" class="btn btn-outline-secondary" data-act="edit" title="Edit this theme">
				<i class="fas fa-pen me-1"></i>Edit
			</button>
			<button type="button" class="btn btn-outline-danger" data-act="delete" title="Delete this theme" aria-label="Delete theme">
				<i class="fas fa-trash"></i>
			</button>
		</div>
	`;
	container.appendChild(row);

	const select = row.querySelector<HTMLSelectElement>("select")!;
	const editBtn = row.querySelector<HTMLButtonElement>('[data-act="edit"]')!;
	const deleteBtn = row.querySelector<HTMLButtonElement>(
		'[data-act="delete"]',
	)!;
	const newBtn = row.querySelector<HTMLButtonElement>('[data-act="new"]')!;
	const galleryBtn = row.querySelector<HTMLButtonElement>(
		'[data-act="gallery"]',
	)!;

	const rawActiveId = () =>
		(values.config.themeCreator as any).activeThemeId || "default";

	function activeId(): string {
		const id = rawActiveId();
		return id === "default" ||
			id in THEME_PRESETS ||
			saved.some((t) => t.id === id)
			? id
			: "default";
	}

	const activeSavedTheme = () => saved.find((t) => t.id === activeId()) ?? null;

	async function setActive(id: string) {
		(values.config as any).themeCreator = { activeThemeId: id };
		await preferences.setValue(values);
		saved = await _savedThemes.getValue();
		applyThemeById(id, saved);
	}

	function renderSelect() {
		select.innerHTML = "";
		select.add(new Option("Default (Polytoria)", "default"));
		const presets = document.createElement("optgroup");
		presets.label = "Built-in Presets";
		for (const [key, p] of Object.entries(THEME_PRESETS))
			presets.appendChild(new Option(p.name, key));
		select.add(presets);
		if (saved.length > 0) {
			const mine = document.createElement("optgroup");
			mine.label = "My Themes";
			for (const t of saved) mine.appendChild(new Option(t.name, t.id));
			select.add(mine);
		}
		select.value = activeId();
	}

	function updateButtons() {
		const id = activeId();
		select.disabled = !enabled;
		newBtn.disabled = !enabled;
		galleryBtn.disabled = !enabled;
		editBtn.disabled = !enabled || id === "default";
		deleteBtn.disabled = !enabled || !activeSavedTheme();
	}

	async function refresh() {
		saved = await _savedThemes.getValue();
		renderSelect();
		updateButtons();
	}

	function openEditor() {
		window.open(EDITOR_URL, "_blank");
	}

	select.addEventListener("change", async () => {
		await setActive(select.value);
		updateButtons();
	});

	editBtn.addEventListener("click", async () => {
		const id = activeId();
		if (id in THEME_PRESETS) {
			editBtn.disabled = true;
			const fork = await forkPreset(id);
			await setActive(fork.id);
			await refresh();
		}
		openEditor();
	});

	deleteBtn.addEventListener("click", () => {
		const theme = activeSavedTheme();
		if (theme) confirmDelete(theme);
	});

	newBtn.addEventListener("click", () => {
		openNewThemeModal(async (create) => {
			const theme = await create();
			await setActive(theme.id);
			await refresh();
			openEditor();
		});
	});

	galleryBtn.addEventListener("click", () => {
		openThemeGallery(() => refresh());
	});

	function confirmDelete(theme: SavedTheme) {
		const modal = createModal();
		modal.addEventListener("close", () => modal.remove());
		modal.innerHTML = `
			<div class="d-flex justify-content-between align-items-center mb-3">
				<h5 class="mb-0 fw-bold">Delete Theme</h5>
				<button class="btn-close" data-close aria-label="Close"></button>
			</div>
			<p class="text-muted small mb-3"></p>
			<div class="d-flex gap-2 justify-content-end">
				<button class="btn btn-sm btn-secondary" data-close>Cancel</button>
				<button class="btn btn-sm btn-danger" data-confirm>
					<i class="fas fa-trash me-1"></i>Delete
				</button>
			</div>
		`;
		modal.querySelector("p")!.textContent =
			`Are you sure you want to delete "${theme.name}"? This cannot be undone.`;
		for (const el of modal.querySelectorAll("[data-close]"))
			el.addEventListener("click", () => modal.close());
		modal
			.querySelector<HTMLButtonElement>("[data-confirm]")!
			.addEventListener("click", async (e) => {
				(e.currentTarget as HTMLButtonElement).disabled = true;
				await deleteSavedTheme(theme);
				saved = await _savedThemes.getValue();
				if (rawActiveId() === theme.id) await setActive("default");
				await refresh();
				modal.close();
			});
		modal.showModal();
	}

	let unwatchThemes: () => void = () => {};
	let unwatchPrefs: () => void = () => {};
	const stopWatching = () => {
		unwatchThemes();
		unwatchPrefs();
	};
	unwatchThemes = _savedThemes.watch(() => {
		if (!row.isConnected) return stopWatching();
		void refresh();
	});
	unwatchPrefs = preferences.watch((next) => {
		if (!row.isConnected) return stopWatching();
		if (next?.config?.themeCreator)
			(values.config as any).themeCreator = next.config.themeCreator;
		void refresh();
	});

	void refresh();

	return {
		setEnabled(next) {
			enabled = next;
			updateButtons();
		},
	};
}
