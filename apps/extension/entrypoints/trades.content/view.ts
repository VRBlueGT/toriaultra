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

import type { CurrencyCode, ParsedTrade } from "@/utils/types";

/**
 * Converts relevant currency text to real-life currency.
 * @param trade The current trade.
 * @param currency The currency to convert to.
 */
export async function irlBrickPrice(
	trade: ParsedTrade,
	currency: CurrencyCode,
) {
	const cards = document.querySelectorAll(".card");
	if (cards.length < 2) return;

	for (let i = 0; i < 2; i++) {
		const side = trade.sides[i];
		if (!side) continue;

		const footer = cards[i]!.querySelector(".card-footer");
		const brickSpans = footer?.querySelectorAll(".text-success");
		if (!brickSpans) continue;

		const targets: { span: Element; bricks: number }[] = [];
		if (brickSpans[0])
			targets.push({ span: brickSpans[0], bricks: side.totalValue });
		if (brickSpans.length >= 3 && brickSpans[1])
			targets.push({ span: brickSpans[1], bricks: side.bricksAdded });
		const lastSpan = brickSpans[brickSpans.length - 1];
		if (lastSpan && lastSpan !== brickSpans[0])
			targets.push({ span: lastSpan, bricks: side.netValue });

		const seen = new Set<Element>();
		for (const { span, bricks } of targets) {
			if (bricks <= 0 || seen.has(span)) continue;
			seen.add(span);
			const converted = await bricksToCurrency(bricks, currency);
			if (converted) span.innerHTML += ` (${converted})`;
		}
	}
}