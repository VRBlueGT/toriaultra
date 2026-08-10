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
import type {
	AvatarSandboxOutfit,
	FeedApi,
	ForumSearchFilters,
	PlacesListingApi,
	PlacesListingFilters,
	Result,
	StoreListingApi,
	StoreListingFilters,
} from "./types";

export interface ProtocolMap {
	openPreferences(): void;
	downloadPlaceFile(id: number): void;
	getModelFile(id: number): string;
	joinPlace(data: { placeId: number; serverId?: number; version: 1 | 2 }): void;
	registerBootstrapElements(): void;
	getStreakFreezeCount(): Promise<Result<number | null>>;
	disableFeedAutoScroll(): void;
	getFeed(page: number): Promise<Result<FeedApi>>;
	getStoreListing(
		filters: StoreListingFilters,
	): Promise<Result<StoreListingApi>>;
	disablePlacesAutoScroll(): void;
	getPlacesListing(
		filters: PlacesListingFilters,
	): Promise<Result<PlacesListingApi>>;
	getForumSearch(
		filters: ForumSearchFilters,
	): Promise<Result<PolyTrack.ForumSearchApi>>;
	getForumReplyRedirect(replyId: number): Promise<Result<string>>;
	showHiddenCategoryAlert(): void;
	openCreator(version: 1 | 2): void;
	changeUserAlias(data: { userId: number; currentAlias?: string }): void;

	getUser(id: number): Promise<Result<Polytoria.UserApi>>;
	findUserByUsername(username: string): Promise<Result<number>>;
	searchUsersByActivity(
		query: string,
	): Promise<Result<Extension.ActivitySearchApi["data"]>>;
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
		limit?: number;
	}): Promise<Result<Polytoria.UserCreationsApi>>;
	updateBodyColor(data: { bodyPart: string; color: string }): void;
	getUserCharts(userId: number): Promise<Result<PolyTrack.UserChartsApi>>;
	getWorldStatsChart(data: {
		placeId: number;
		metric: PolyTrack.WorldStatsMetric;
		start: string;
		stop: string;
		window?: string;
	}): Promise<Result<PolyTrack.WorldStatsChartApi>>;
	getWorldIngameChart(data: {
		placeId: number;
		start: string;
		stop: string;
		window?: string;
	}): Promise<Result<PolyTrack.WorldIngameChartApi>>;
	getWorldVersions(
		worldIds: number[],
	): Promise<Result<Record<string, "1.0" | "2.0" | null>>>;

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
	getAssetAudio(id: number): Promise<Result<Polytoria.AudioApi>>;
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

	getGameActivity(data: {
		userId: number;
		gameId: number;
		page?: number;
		pageSize?: number;
		forceRefresh?: boolean;
	}): Promise<Result<PolyTrack.GameActivityApi>>;

	getApiSession(userId: number): Promise<Result<Extension.CurrentSessionApi>>;
	startKilnVerification(
		userId: number,
	): Promise<Result<Extension.AuthStartApi>>;
	finishKilnVerification(userId: number): Promise<Result<Extension.AuthEndApi>>;
	terminateKilnSession(userId: number): Promise<Result<null>>;
	getKilnSessions(userId: number): Promise<Result<Extension.AuthSessionsApi>>;
	terminateKilnSessionById(data: {
		userId: number;
		sessionId: string;
	}): Promise<Result<null>>;

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
	getProfanityFilter(): Promise<Result<string>>;
	submitFeedback(data: {
		type: "feature" | "general" | "bug";
		message: string;
		version: string;
		username: string;
	}): Promise<Result<{ ok: boolean }>>;

	getAvatarOutfits(userId: number): Promise<Result<Extension.AvatarOutfitsApi>>;
	saveAvatarOutfits(data: {
		userId: number;
		outfits: AvatarSandboxOutfit[];
	}): Promise<Result<{ success: boolean }>>;

	getPlaceReviews(data: {
		placeId: number;
		userId: number;
	}): Promise<Result<Extension.PlaceReviewsApi>>;
	submitPlaceReview(data: {
		placeId: number;
		userId: number;
		rating: number;
		body?: string;
	}): Promise<Result<Extension.PlaceReviewApi>>;
	deleteMyPlaceReview(data: {
		placeId: number;
		userId: number;
	}): Promise<Result<null>>;
	submitReviewReply(data: {
		userId: number;
		reviewId: string;
		body: string;
	}): Promise<Result<Extension.PlaceReviewReplyApi>>;
	deleteReviewReply(data: {
		userId: number;
		replyId: string;
	}): Promise<Result<null>>;

	getKilnNotifications(
		userId: number,
	): Promise<Result<Extension.NotificationsApi>>;
	markKilnNotificationSeen(data: {
		userId: number;
		notificationId: number;
	}): Promise<Result<Extension.MarkNotificationSeenApi>>;

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

	showSecurityKeyRenamePrompt(data: {
		currentName: string;
	}): Promise<Result<string | null>>;

	updateOutfit(data: { id: number; name: string }): Promise<Result<unknown>>;
}

export const { sendMessage, onMessage } =
	defineExtensionMessaging<ProtocolMap>();
