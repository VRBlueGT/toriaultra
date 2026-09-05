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
	createKilnDisclosureBadge,
	getProfanityFilter,
} from "@/utils/utilities";

const DEFAULT_MAX_CHARS = 5000;

export function improvedForumComposer(
	showCharacterCount: boolean,
	showMarkdownBtns: boolean,
	autoShowPreview: boolean,
	highlightFilteredWords: boolean,
	showDisclosures: boolean,
) {
	const textarea = document.querySelector<HTMLTextAreaElement>(
		'textarea[name="content"]',
	);
	if (!textarea) return;

	const MAX_CHARS =
		textarea.maxLength > 0 ? textarea.maxLength : DEFAULT_MAX_CHARS;

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
		{
			icon: "fa-file-code",
			title: "Code Block",
			prefix: "```\n",
			suffix: "\n```",
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

	if (showDisclosures) {
		const badge = createKilnDisclosureBadge();
		if (!showCharacterCount) badge.classList.add("ms-auto");
		toolbar.appendChild(badge);
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

	const textareaContainer = document.createElement("div");
	textareaContainer.style.cssText = "position: relative; width: 100%;";

	textarea.parentElement?.insertBefore(wrapper, textarea);
	textareaContainer.appendChild(textarea);
	wrapper.appendChild(textareaContainer);
	wrapper.appendChild(preview);

	if (highlightFilteredWords) {
		initFilterHighlighting(textarea, textareaContainer);
		initTitleFilterHighlighting(textarea);
	}

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
		textareaContainer.style.width = "50%";
		preview.classList.remove("d-none");
		preview.style.width = "50%";
		previewBtn.classList.replace("btn-outline-secondary", "btn-secondary");
		updatePreview();
	};

	const closePreview = () => {
		previewOpen = false;
		textareaContainer.style.width = "100%";
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

type FilterField = HTMLTextAreaElement | HTMLInputElement;

function initTitleFilterHighlighting(textarea: HTMLTextAreaElement) {
	const title = textarea
		.closest("form")
		?.querySelector<HTMLInputElement>('input[name="title"]');
	const container = title?.parentElement;
	if (!title || !container) return;

	if (getComputedStyle(container).position === "static") {
		container.style.position = "relative";
	}

	initFilterHighlighting(title, container);
}

function initFilterHighlighting(field: FilterField, container: HTMLElement) {
	const isInput = field instanceof HTMLInputElement;

	const backdrop = document.createElement("div");
	backdrop.setAttribute("aria-hidden", "true");
	backdrop.style.cssText = `
		position: absolute;
		top: 0;
		left: 0;
		z-index: 1;
		overflow: hidden;
		color: transparent;
		pointer-events: none;
	`;

	const copiedProps = [
		"boxSizing",
		"paddingTop",
		"paddingRight",
		"paddingBottom",
		"paddingLeft",
		"borderTopWidth",
		"borderRightWidth",
		"borderBottomWidth",
		"borderLeftWidth",
		"borderStyle",
		"borderRadius",
		"fontFamily",
		"fontSize",
		"fontWeight",
		"fontStyle",
		"fontVariant",
		"letterSpacing",
		"wordSpacing",
		"lineHeight",
		"textAlign",
		"textIndent",
		"textTransform",
		"whiteSpace",
		"overflowWrap",
		"wordBreak",
		"direction",
	] as const;

	const syncGeometry = () => {
		const cs = getComputedStyle(field);
		for (const prop of copiedProps) {
			backdrop.style[prop] = cs[prop];
		}
		backdrop.style.borderColor = "transparent";
		if (isInput) backdrop.style.whiteSpace = "pre";

		const borderX =
			Number.parseFloat(cs.borderLeftWidth) +
			Number.parseFloat(cs.borderRightWidth);
		const borderY =
			Number.parseFloat(cs.borderTopWidth) +
			Number.parseFloat(cs.borderBottomWidth);

		const scrollbarX = Math.max(
			0,
			field.offsetWidth - field.clientWidth - borderX,
		);
		const scrollbarY = Math.max(
			0,
			field.offsetHeight - field.clientHeight - borderY,
		);

		backdrop.style.paddingRight = `${Number.parseFloat(cs.paddingRight) + scrollbarX}px`;
		backdrop.style.paddingBottom = `${Number.parseFloat(cs.paddingBottom) + scrollbarY}px`;
		backdrop.style.top = `${field.offsetTop}px`;
		backdrop.style.left = `${field.offsetLeft}px`;
		backdrop.style.width = `${field.offsetWidth}px`;
		backdrop.style.height = `${field.offsetHeight}px`;
	};

	container.insertBefore(backdrop, field);
	syncGeometry();

	let filters: RegExp[] = [];

	const syncScroll = () => {
		backdrop.scrollTop = field.scrollTop;
		backdrop.scrollLeft = field.scrollLeft;
	};

	const render = () => {
		const text = field.value;
		if (filters.length === 0) {
			backdrop.innerHTML = "";
			return;
		}

		const ranges = findFilteredRanges(text, filters);
		let html = "";
		let lastIndex = 0;

		for (const [start, end] of ranges) {
			html += escapeHtml(text.slice(lastIndex, start));
			html += `<mark class="kiln-filtered-word">${escapeHtml(text.slice(start, end))}</mark>`;
			lastIndex = end;
		}
		html += escapeHtml(text.slice(lastIndex));

		backdrop.innerHTML = text.endsWith("\n") ? `${html} ` : html;
		syncScroll();
	};

	field.addEventListener("input", render);
	for (const event of ["scroll", "keyup", "click", "select", "focus", "blur"]) {
		field.addEventListener(event, () => {
			syncScroll();
			requestAnimationFrame(syncScroll);
		});
	}

	new ResizeObserver(() => {
		syncGeometry();
		syncScroll();
	}).observe(field);

	getProfanityFilter().then((loadedFilters) => {
		filters = loadedFilters;
		if (import.meta.env.MODE == "development") {
			console.log(
				`[Kiln] Filter highlighting initialized on ${isInput ? "title" : "content"} with ${filters.length} pattern(s)`,
			);
		}
		render();
	});
}

function findFilteredRanges(
	text: string,
	filters: RegExp[],
): [number, number][] {
	const raw: [number, number][] = [];

	for (const re of filters) {
		re.lastIndex = 0;
		let match: RegExpExecArray | null = re.exec(text);
		while (match) {
			if (match[0].length === 0) {
				re.lastIndex++;
			} else {
				raw.push([match.index, match.index + match[0].length]);
			}
			match = re.exec(text);
		}
	}

	raw.sort((a, b) => a[0] - b[0] || b[1] - a[1]);

	const merged: [number, number][] = [];
	for (const range of raw) {
		const last = merged[merged.length - 1];
		if (last && range[0] < last[1]) {
			last[1] = Math.max(last[1], range[1]);
		} else {
			merged.push(range);
		}
	}

	return merged
		.map(([start, end]): [number, number] => {
			while (start < end && /\s/.test(text[start])) start++;
			while (end > start && /\s/.test(text[end - 1])) end--;
			return [start, end];
		})
		.filter(([start, end]) => end > start);
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

function renderMarkdown(text: string): string {
	const escaped = text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");

	const codeBlocks: string[] = [];
	const withoutCodeBlocks = escaped.replace(
		/```\w*\n?([\s\S]*?)```/g,
		(_match, code: string) => {
			const token = `<codeblock-${codeBlocks.length}>`;
			codeBlocks.push(
				`<pre class="hljs markdown-code"><code>${code.replace(/\n/g, "<br>")}</code></pre>`,
			);
			return token;
		},
	);

	const rendered = withoutCodeBlocks
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

	return rendered.replace(
		/<codeblock-(\d+)>/g,
		(_match, idx: string) => codeBlocks[Number(idx)],
	);
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
