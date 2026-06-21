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

import { Extension } from "@kiln/schemas";
import { onMessage } from "@/utils/messaging";
import { apiSessions } from "@/utils/storage";
import { pullKVCache } from "@/utils/utilities";
import { handle, safeFetch, withApi, withAuthSession } from "./shared";

onMessage("getApiSession", ({ data: userId }) =>
	handle(() =>
		pullKVCache(
			"currentSession",
			String(userId),
			() =>
				withAuthSession(userId, (token, config) =>
					safeFetch(
						`${config.resolvedUrls.extension}auth/me`,
						Extension.CurrentSessionApi,
						{
							headers: {
								Authorization: `Bearer ${token}`,
								"x-kiln-version": browser.runtime.getManifest().version,
							},
						},
					),
				),
			5 * 60 * 1000,
			false,
		),
	),
);

onMessage("startKilnVerification", ({ data: userId }) =>
	handle(async () => {
		const config = await withApi("kiln_api", "extension");
		const sessionStore = await apiSessions.getValue();
		const session = sessionStore.find((session) => session.userId == userId);
		if (session) throw new Error("Session already exists for user");
		return safeFetch(
			`${config.resolvedUrls.extension}auth/flow/start`,
			Extension.AuthStartApi,
			{
				credentials: "include",
				method: "POST",
				body: JSON.stringify({ userId }),
			},
		);
	}),
);

onMessage("finishKilnVerification", ({ data: userId }) =>
	handle(async () => {
		const config = await withApi("kiln_api", "extension");
		const sessionStore = await apiSessions.getValue();
		const session = sessionStore.find((session) => session.userId == userId);
		if (!session?.verificationToken)
			throw new Error("No pending verification for user");
		return safeFetch(
			`${config.resolvedUrls.extension}auth/flow/end`,
			Extension.AuthEndApi,
			{
				credentials: "include",
				method: "POST",
				headers: { Authorization: `Bearer ${session.verificationToken}` },
			},
		);
	}),
);

onMessage("getPublishedTheme", ({ data: id }) =>
	handle(async () => {
		const config = await withApi("kiln_api", "extension");
		return safeFetch(
			`${config.resolvedUrls.extension}themes/${encodeURIComponent(id)}`,
			Extension.GetPublishedThemeApi,
		);
	}),
);

onMessage("getThemeGallery", ({ data: page }) =>
	handle(async () => {
		const config = await withApi("kiln_api", "extension");
		return safeFetch(
			`${config.resolvedUrls.extension}themes/gallery?page=${page ?? 1}`,
			Extension.ThemeGalleryApi,
		);
	}),
);

onMessage("publishTheme", ({ data }) =>
	handle(() =>
		withAuthSession(data.userId, (token, config) =>
			safeFetch(
				`${config.resolvedUrls.extension}themes`,
				Extension.PublishThemeApi,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						name: data.name,
						accentColor: data.accentColor,
						navbarColor: data.navbarColor,
						...(data.fontFamily ? { fontFamily: data.fontFamily } : {}),
						...(data.customCss ? { customCss: data.customCss } : {}),
						...(data.backgroundImage
							? { backgroundImage: data.backgroundImage }
							: {}),
						...(data.effects?.length ? { effects: data.effects } : {}),
						...(data.existingId ? { existingId: data.existingId } : {}),
						...(data.navbarIconColor
							? { navbarIconColor: data.navbarIconColor }
							: {}),
						...(data.colorTokens && Object.keys(data.colorTokens).length
							? { colorTokens: data.colorTokens }
							: {}),
					}),
				},
			),
		),
	),
);

onMessage("unpublishTheme", ({ data }) =>
	handle(() =>
		withAuthSession(data.userId, (token, config) =>
			safeFetch(
				`${config.resolvedUrls.extension}themes/${data.id}/unpublish`,
				Extension.UnpublishThemeApi,
				{
					method: "POST",
					headers: { Authorization: `Bearer ${token}` },
				},
			),
		),
	),
);

onMessage("deletePublishedTheme", ({ data }) =>
	handle(() =>
		withAuthSession(data.userId, (token, config) =>
			safeFetch(
				`${config.resolvedUrls.extension}themes/${data.id}`,
				Extension.UnpublishThemeApi,
				{
					method: "DELETE",
					headers: { Authorization: `Bearer ${token}` },
				},
			),
		),
	),
);

onMessage("reportTheme", ({ data }) =>
	handle(async () => {
		const config = await withApi("kiln_api", "extension");
		return safeFetch(
			`${config.resolvedUrls.extension}themes/${encodeURIComponent(data.id)}/report`,
			Extension.ReportThemeApi,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ reason: data.reason }),
			},
		);
	}),
);

onMessage("adminGetPendingThemes", ({ data: userId }) =>
	handle(() =>
		withAuthSession(userId, (token, config) =>
			safeFetch(
				`${config.resolvedUrls.extension}admin/themes/pending`,
				Extension.AdminPendingThemesApi,
				{ headers: { Authorization: `Bearer ${token}` } },
			),
		),
	),
);

onMessage("adminReviewTheme", ({ data }) =>
	handle(() =>
		withAuthSession(data.userId, (token, config) =>
			safeFetch(
				`${config.resolvedUrls.extension}admin/themes/${encodeURIComponent(data.id)}/${data.action}`,
				Extension.AdminReviewThemeApi,
				{
					method: "POST",
					headers: { Authorization: `Bearer ${token}` },
				},
			),
		),
	),
);

onMessage("adminListConfigs", ({ data: userId }) =>
	handle(() =>
		withAuthSession(userId, (token, config) =>
			safeFetch(
				`${config.resolvedUrls.extension}admin/config`,
				Extension.AdminConfigListApi,
				{ headers: { Authorization: `Bearer ${token}` } },
			),
		),
	),
);

onMessage("adminGetConfig", ({ data }) =>
	handle(() =>
		withAuthSession(data.userId, (_token, config) =>
			safeFetch(
				`${config.resolvedUrls.extension}data/config?v=${encodeURIComponent(data.version)}`,
				Extension.ExtensionConfigSchema,
				{},
			),
		),
	),
);

onMessage("adminUpdateConfig", ({ data }) =>
	handle(() =>
		withAuthSession(data.userId, (token, config) =>
			safeFetch(
				`${config.resolvedUrls.extension}admin/config/${encodeURIComponent(data.version)}`,
				Extension.AdminConfigApi,
				{
					method: "PUT",
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify(data.patch),
				},
			),
		),
	),
);

onMessage("adminDeleteConfig", ({ data }) =>
	handle(() =>
		withAuthSession(data.userId, (token, config) =>
			safeFetch(
				`${config.resolvedUrls.extension}admin/config/${encodeURIComponent(data.version)}`,
				Extension.AdminDeleteConfigApi,
				{
					method: "DELETE",
					headers: { Authorization: `Bearer ${token}` },
				},
			),
		),
	),
);

onMessage("adminDeleteTheme", ({ data }) =>
	handle(() =>
		withAuthSession(data.userId, (token, config) =>
			safeFetch(
				`${config.resolvedUrls.extension}admin/themes/${encodeURIComponent(data.id)}`,
				Extension.AdminDeleteThemeApi,
				{
					method: "DELETE",
					headers: { Authorization: `Bearer ${token}` },
				},
			),
		),
	),
);