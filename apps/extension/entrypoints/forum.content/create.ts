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

const MAX_CHARS = 5000;

export function improvedForumComposer(
	showCharacterCount: boolean,
	showMarkdownBtns: boolean,
	autoShowPreview: boolean,
) {
	const textarea = document.querySelector<HTMLTextAreaElement>(
		'textarea[name="content"]',
	);
	if (!textarea) return;

	const toolbar = document.createElement("div");
	toolbar.className = "d-flex align-items-center gap-1 mb-1 flex-wrap";

	const buttons = [
		{
			icon: "fa-italic",
			title: "Italic",
			prefix: "*",
			suffix: "*",
			placeholder: "italic text",
		},
		{
			icon: "fa-strikethrough",
			title: "Strikethrough",
			prefix: "~~",
			suffix: "~~",
			placeholder: "strikethrough",
		},
		{
			icon: "fa-code",
			title: "Inline Code",
			prefix: "`",
			suffix: "`",
			placeholder: "code",
		},
	];

	if (showMarkdownBtns) {
		for (const btn of buttons) {
			const button = document.createElement("button");
			button.type = "button";
			button.className = "btn btn-sm btn-outline-secondary";
			button.innerHTML = `<i class="fas ${btn.icon}"></i>`;
			button.title = btn.title;
			button.addEventListener("click", () => {
				wrapSelection(textarea, btn.prefix, btn.suffix, btn.placeholder);
				textarea.focus();
			});
			toolbar.appendChild(button);
		}
	}

	const previewBtn = document.createElement("button");
	previewBtn.type = "button";
	previewBtn.className = "btn btn-sm btn-outline-secondary";
	previewBtn.innerHTML = '<i class="fas fa-eye"></i>';
	previewBtn.title = "Toggle Preview";
	toolbar.appendChild(previewBtn);

	const counter = document.createElement("span");
	counter.className = "ms-auto text-muted small";

	const updateCounter = () => {
		const len = textarea.value.length;
		counter.textContent = `${len}/${MAX_CHARS}`;
		if (len > MAX_CHARS) {
			counter.classList.replace("text-muted", "text-danger");
		} else {
			counter.classList.replace("text-danger", "text-muted");
		}
	};

	if (showCharacterCount) {
		textarea.addEventListener("input", updateCounter);
		updateCounter();
		toolbar.appendChild(counter);
	}
	textarea.parentElement?.insertBefore(toolbar, textarea);

	const preview = document.createElement("div");
	preview.className =
		"form-control bg-transparent border border-secondary d-none";
	preview.style.cssText =
		"overflow-y: auto; white-space: pre-wrap; word-break: break-word;";

	const wrapper = document.createElement("div");
	wrapper.className = "d-flex gap-2";
	wrapper.style.minHeight =
		textarea.style.height || `${textarea.offsetHeight}px`;

	textarea.parentElement?.insertBefore(wrapper, textarea);
	wrapper.appendChild(textarea);
	wrapper.appendChild(preview);

	const syncHeight = () => {
		preview.style.height = `${textarea.offsetHeight}px`;
	};

	const updatePreview = () => {
		preview.innerHTML = renderMarkdown(textarea.value);
		syncHeight();
	};

	textarea.addEventListener("input", updatePreview);

	let previewOpen = false;

	const openPreview = () => {
		if (previewOpen) return;
		previewOpen = true;
		textarea.style.width = "50%";
		preview.classList.remove("d-none");
		preview.style.width = "50%";
		previewBtn.classList.replace("btn-outline-secondary", "btn-secondary");
		updatePreview();
	};

	const closePreview = () => {
		previewOpen = false;
		textarea.style.width = "";
		preview.classList.add("d-none");
		previewBtn.classList.replace("btn-secondary", "btn-outline-secondary");
	};

	if (autoShowPreview) {
		textarea.addEventListener("input", () => {
			if (textarea.value.length > 0) openPreview();
		});
	}

	previewBtn.addEventListener("click", () => {
		if (previewOpen) closePreview();
		else openPreview();
	});
}

function renderMarkdown(text: string): string {
	const escaped = text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");

	return escaped
		.replace(/^###### (.+)$/gm, "<h6>$1</h6>")
		.replace(/^##### (.+)$/gm, "<h5>$1</h5>")
		.replace(/^#### (.+)$/gm, "<h4>$1</h4>")
		.replace(/^### (.+)$/gm, "<h3>$1</h3>")
		.replace(/^## (.+)$/gm, "<h2>$1</h2>")
		.replace(/^# (.+)$/gm, "<h1>$1</h1>")
		.replace(/`([^`]+)`/g, "<code>$1</code>")
		.replace(/\*(.+?)\*/g, "<em>$1</em>")
		.replace(/~~(.+?)~~/g, "<s>$1</s>")
		.replace(/\n/g, "<br>");
}

function wrapSelection(
	textarea: HTMLTextAreaElement,
	prefix: string,
	suffix: string,
	placeholder: string,
) {
	const start = textarea.selectionStart;
	const end = textarea.selectionEnd;
	const val = textarea.value;

	const insideWrapped =
		val.slice(start, start + prefix.length) === prefix &&
		(suffix === "" || val.slice(end - suffix.length, end) === suffix);

	const outsideWrapped =
		val.slice(start - prefix.length, start) === prefix &&
		(suffix === "" || val.slice(end, end + suffix.length) === suffix);

	if (insideWrapped) {
		const inner = val.slice(start + prefix.length, end - (suffix.length || 0));
		textarea.value = val.slice(0, start) + inner + val.slice(end);
		textarea.selectionStart = start;
		textarea.selectionEnd = start + inner.length;
	} else if (outsideWrapped) {
		const inner = val.slice(start, end);
		const removeStart = start - prefix.length;
		const removeEnd = end + suffix.length;
		textarea.value = val.slice(0, removeStart) + inner + val.slice(removeEnd);
		textarea.selectionStart = removeStart;
		textarea.selectionEnd = removeStart + inner.length;
	} else {
		const inner = val.slice(start, end) || placeholder;
		textarea.value =
			val.slice(0, start) + prefix + inner + suffix + val.slice(end);
		const innerStart = start + prefix.length;
		textarea.selectionStart = innerStart;
		textarea.selectionEnd = innerStart + inner.length;
	}

	textarea.dispatchEvent(new Event("input", { bubbles: true }));
}
