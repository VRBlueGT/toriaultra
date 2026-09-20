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

import { _reportedTimezones } from "@/utils/storage";
import { getApiSession } from "@/utils/utilities";

const REFRESH_MS = 7 * 24 * 60 * 60 * 1000;

export async function syncPublicTimezone(userId: number, share: boolean) {
	const reported = await _reportedTimezones.getValue();
	const last = reported[userId];

	if (!share) {
		if (!last) return;
		const result = await sendMessage("clearUserTimezone", userId);
		if (result.ok) {
			const { [userId]: _removed, ...rest } =
				await _reportedTimezones.getValue();
			await _reportedTimezones.setValue(rest);
		}
		return;
	}

	const session = await getApiSession(userId);
	if (session?.state !== "verified") return;

	const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
	if (!timezone) return;

	if (last?.timezone === timezone && Date.now() - last.reportedAt < REFRESH_MS)
		return;

	const result = await sendMessage("setUserTimezone", { userId, timezone });
	if (result.ok) {
		await _reportedTimezones.setValue({
			...(await _reportedTimezones.getValue()),
			[userId]: { timezone, reportedAt: Date.now() },
		});
	}
}
