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

import type { Extension, LOVE, PolyTrack, Polytoria } from "@kiln/schemas";
import { defineExtensionMessaging } from "@webext-core/messaging";
import type { PolytoriaTradeOwnerHistory } from "../../../packages/schemas/src/apis/love";
import type { AvatarSandboxOutfit, Result } from "./types";

export interface ProtocolMap {
	openPreferences(): void;
	downloadPlaceFile(id: number): void;
	getModelFile(id: number): string;
	joinPlace(data: { placeId: number; serverId?: number; version: 1 | 2 }): void;
	registerBootstrapElements(): void;
	sendAnalyticEvent(data: { name: string; data?: Record<string, unknown> }): {
		ok: boolean;
	};
	openCreator(version: 1 | 2): void;
	changeUserAlias(data: { userId: number; currentAlias?: string }): void;

	getUser(id: number): Promise<Result<Polytoria.UserApi>>;
	findUserByUsername(username: string): Promise<Result<number>>;
	getUserAvatar(id: number): Promise<Result<Polytoria.AvatarApi>>;
	getBestFriends(userIds: number[]): Promise<Result<Polytoria.UserApi[]>>;
	getUserInventory(data: {
		userId: number;
		limit: number;
		page?: number;
		collectiblesOnly?: boolean;
	}): Promise<Result<Polytoria.InventoryApi>>;
	getOwnedAssetMap(
		userId: number,
	): Promise<Result<Record<number, { isLimited: boolean; serials: number[] }>>>;
	getFriendRequests(): Promise<Result<{ senderID: number }[]>>;
	manageFriendRequests(
		action: "acceptAll" | "declineAll",
	): Promise<Result<void>>;
	acceptFriendRequest(senderUserId: number): Promise<Result<void>>;
	declineFriendRequest(senderUserId: number): Promise<Result<void>>;
	getProfileVersions(userId: number): Promise<Result<PolyTrack.UserApi>>;
	getUserCreations(data: {
		userId: number;
		page?: number;
	}): Promise<Result<Polytoria.UserCreationsApi>>;
	updateBodyColor(data: { bodyPart: string; color: string }): void;
	getUserCharts(userId: number): Promise<Result<PolyTrack.UserChartsApi>>;

	getStore(data: {
		order?: string;
		sort?: string;
		showOffsale?: boolean;
		types?: string[];
		search?: string;
		page?: number;
		limit?: number;
	}): Promise<Result<Polytoria.StoreApi>>;
	getItem(id: number): Promise<Result<Polytoria.ItemApi>>;
	getItemMesh(id: number): Promise<Result<Polytoria.MeshApi>>;
	getItemTexture(id: number): Promise<Result<Polytoria.TextureApi>>;
	getItemOwners(data: {
		itemId: number;
		limit?: number;
	}): Promise<Result<Polytoria.OwnersApi>>;
	getItemCopy(data: {
		itemId: number;
		userId: number;
	}): Promise<Result<Polytoria.IndividualOwnerApi>>;
	resolveItemThumbnails(
		hashes: string[],
	): Promise<Result<Extension.ItemThumbnailMapApi>>;

	getPlace(id: number): Promise<Result<Polytoria.PlaceApi>>;
	getPlaceGamepasses(placeId: number): Promise<Result<Polytoria.GamepassesApi>>;
	getFavoritedPlaces(userId: number): Promise<Result<Polytoria.PlaceApi[]>>;
	favoritePlace(data: {
		placeId: number;
		userId: number;
	}): Promise<Result<null>>;
	unfavoritePlace(data: {
		placeId: number;
		userId: number;
	}): Promise<Result<null>>;
	bulkWhitelist(data: { placeId: number; usernames: string[] }): void;
	rollRandomPlace(): Promise<Result<void>>;

	rejectTrade(tradeId: number): void;
	getPolytoriaTradeItems(itemIds: number[]): Promise<
		Result<
			{
				itemId: number;
				data: LOVE.PolytoriaTradeItemWithTagsResult | null;
			}[]
		>
	>;
	getItemOwnerHistory(
		itemId: number,
	): Promise<Result<PolytoriaTradeOwnerHistory>>;
	getNFTItems(userId: number): Promise<Result<Extension.NFTItemsApi>>;
	markItemAsNFT(data: {
		userId: number;
		itemId: number;
		serials: number[] | null;
	}): Promise<Result<{ success: boolean }>>;
	unmarkItemAsNFT(data: {
		userId: number;
		itemId: number;
	}): Promise<Result<{ success: boolean }>>;
	getPinnedAchievements(
		userId: number,
	): Promise<Result<Extension.PinnedAchievementsApi>>;
	pinAchievement(data: {
		achievementId: number;
		userId: number;
	}): Promise<Result<null>>;
	unpinAchievement(data: {
		achievementId: number;
		userId: number;
	}): Promise<Result<null>>;

	getBlockedTraders(
		userId: number,
	): Promise<Result<Extension.BlockedTradersApi>>;
	blockTrader(data: {
		userId: number;
		blockedUserId: number;
	}): Promise<Result<{ success: boolean }>>;
	unblockTrader(data: {
		userId: number;
		blockedUserId: number;
	}): Promise<Result<{ success: boolean }>>;

	startTimePlayedSession(data: {
		userId: number;
		placeId?: number;
	}): Promise<Result<Extension.PlaySessionApi>>;
	pingTimePlayedSession(data: {
		userId: number;
		sessionId: string;
	}): Promise<Result<Extension.PlaySessionApi>>;
	endTimePlayedSession(data: {
		userId: number;
		sessionId: string;
	}): Promise<Result<Extension.PlaySessionApi>>;
	deleteTimePlayedSession(data: {
		userId: number;
		sessionId: string;
	}): Promise<Result<null>>;
	getTimePlayedSessions(data: {
		userId: number;
		page?: number;
		placeId?: number;
	}): Promise<Result<Extension.PlaySessionListApi>>;
	getTimePlayedSummary(
		userId: number,
	): Promise<Result<Extension.TimePlayedSummaryApi>>;

	getApiSession(userId: number): Promise<Result<Extension.CurrentSessionApi>>;
	startKilnVerification(
		userId: number,
	): Promise<Result<Extension.AuthStartApi>>;
	finishKilnVerification(userId: number): Promise<Result<Extension.AuthEndApi>>;

	publishTheme(data: {
		userId: number;
		name: string;
		accentColor: string;
		navbarColor: string;
		fontFamily?: string;
		customCss?: string;
		backgroundImage?: string;
		effects?: import("./types").ThemeEffect[];
		existingId?: string;
		navbarIconColor?: string;
		colorTokens?: Record<string, string>;
	}): Promise<Result<Extension.PublishThemeApi>>;
	getPublishedTheme(
		id: string,
	): Promise<Result<Extension.GetPublishedThemeApi>>;
	getThemeGallery(page?: number): Promise<Result<Extension.ThemeGalleryApi>>;
	unpublishTheme(data: {
		userId: number;
		id: string;
	}): Promise<Result<Extension.UnpublishThemeApi>>;
	deletePublishedTheme(data: {
		userId: number;
		id: string;
	}): Promise<Result<Extension.UnpublishThemeApi>>;
	reportTheme(data: {
		id: string;
		reason: string;
	}): Promise<Result<Extension.ReportThemeApi>>;

	adminGetPendingThemes(
		userId: number,
	): Promise<Result<Extension.AdminPendingThemesApi>>;
	adminReviewTheme(data: {
		userId: number;
		id: string;
		action: "approve" | "decline";
	}): Promise<Result<Extension.AdminReviewThemeApi>>;
	adminListConfigs(
		userId: number,
	): Promise<Result<Extension.AdminConfigListApi>>;
	adminGetConfig(data: {
		userId: number;
		version: string;
	}): Promise<Result<Extension.ExtensionConfig>>;
	adminUpdateConfig(data: {
		userId: number;
		version: string;
		patch: Partial<Extension.ExtensionConfig>;
	}): Promise<Result<Extension.AdminConfigApi>>;
	adminDeleteConfig(data: {
		userId: number;
		version: string;
	}): Promise<Result<Extension.AdminDeleteConfigApi>>;
	adminDeleteTheme(data: {
		userId: number;
		id: string;
	}): Promise<Result<Extension.AdminDeleteThemeApi>>;

	getConfig(): Promise<Result<Extension.ExtensionConfig>>;
	getChangelog(): Promise<Result<string>>;
	getCurrencyRates(): Promise<Result<Extension.CurrencyExchangeRate>>;
	submitFeedback(data: {
		type: "feature" | "general" | "bug";
		message: string;
		version: string;
	}): Promise<Result<{ ok: boolean }>>;

	getAvatarOutfits(userId: number): Promise<Result<Extension.AvatarOutfitsApi>>;
	saveAvatarOutfits(data: {
		userId: number;
		outfits: AvatarSandboxOutfit[];
	}): Promise<Result<{ success: boolean }>>;

	getRetroItems(page?: number): Promise<Result<Extension.RetroItemsApi>>;
	getEventForItem(itemId: number): Promise<Result<Extension.EventForItemApi>>;
	getEvents(): Promise<Result<Extension.EventsListApi>>;
	getEventItems(eventId: number): Promise<Result<Extension.EventItemsApi>>;
	getGreatDivideStats(
		userId: number,
	): Promise<Result<Extension.GreatDivideStatsApi | Extension.ErrorGeneric>>;
	checkUserActivity(data: {
		userIds: number[];
		days: number;
	}): Promise<
		Result<Record<string, { active: boolean; registeredAt: string | null }>>
	>;
}

export const { sendMessage, onMessage } =
	defineExtensionMessaging<ProtocolMap>();