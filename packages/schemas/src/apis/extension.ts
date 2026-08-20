import z from "zod";

export const ExtensionConfigSchema = z.object({
	latestVersion: z.string(),
	notices: z.array(
		z.object({
			id: z.string(),
			message: z.string(),
			type: z.enum(["info", "warning"]),
		}),
	),
	apiAvailability: z.object({
		public: z.boolean(),
		internal: z.boolean(),
		extension: z.boolean(),
		proxy: z.boolean(),
		currencyRates: z.boolean(),
	}),
	flags: z.record(z.string(), z.boolean()),
	limits: z.object({
		maxPinnedWorlds: z.number().positive().default(25),
		maxNFTItems: z.number().positive().default(50),
		maxNFTSerialsPerItem: z.number().positive().default(10),
		maxBlockedTraders: z.number().positive().default(200),
		maxPublishedThemes: z.number().positive().default(15),
		maxPinnedAchievements: z.number().positive().default(5),
	}),
	users: z.object({
		generativeAI: z.array(z.number()),
	}),
});
export type ExtensionConfig = z.infer<typeof ExtensionConfigSchema>;

export const MetadataSchema = z.object({
	updateLogUrl: z.string().nullable(),
	endpoints: z.object({
		public: z.string(),
		internal: z.string(),
		extension: z.string(),
		proxy: z.string(),
		currencyRates: z.string(),
	}),
	economy: z.object({
		membershipTax: z.object({
			free: z.number().min(0).max(1),
			plus: z.number().min(0).max(1),
			plusDeluxe: z.number().min(0).max(1),
		}),
		visitsPerBrick: z.number().nonnegative(),
	}),
});
export type Metadata = z.infer<typeof MetadataSchema>;

export const CurrentSessionApi = z.object({
	data: z.object({
		state: z.enum(["pending", "verified"]),
		id: z.number(),
		likes: z.number(),
		linkedAt: z.string(),
	}),
});
export type CurrentSessionApi = z.infer<typeof CurrentSessionApi>;

export const AuthStartApi = z.object({
	data: z.object({
		phrase: z.string(),
		token: z.string(),
	}),
});
export type AuthStartApi = z.infer<typeof AuthStartApi>;

export const AuthEndApi = z.object({
	data: z.object({
		userId: z.number(),
		accessToken: z.string(),
		refreshToken: z.string(),
	}),
});
export type AuthEndApi = z.infer<typeof AuthEndApi>;

export const RefreshTokenApi = z.object({
	data: z.object({
		accessToken: z.string(),
		refreshToken: z.string(),
	}),
});
export type RefreshTokenApi = z.infer<typeof RefreshTokenApi>;

export const ErrorGeneric = z.object({
	data: z.null(),
	error: z.object({
		code: z.string(),
		message: z.string(),
	}),
});
export type ErrorGeneric = z.infer<typeof ErrorGeneric>;

export const CurrencyExchangeRate = z.object({
	date: z.iso.date(),
	usd: z.record(z.string(), z.number()),
});
export type CurrencyExchangeRate = z.infer<typeof CurrencyExchangeRate>;

export const RetroItemsApi = z.object({
	data: z.array(
		z.object({
			id: z.number(),
			accessoryType: z.string(),
			name: z.string(),
			assetUrl: z.url().nullable().optional(),
			createdAt: z.string().nullable().optional(),
			updatedAt: z.string().nullable().optional(),
		}),
	),
	meta: z.object({
		currentPage: z.number(),
		perPage: z.number(),
		totalPages: z.number(),
		totalCount: z.number(),
	}),
	links: z.object({
		self: z.string(),
		first: z.string(),
		last: z.string(),
		next: z.string().nullable(),
	}),
});
export type RetroItemsApi = z.infer<typeof RetroItemsApi>;

export const FavoritedPlaceIdsApi = z.object({
	data: z.array(z.number()),
	meta: z.object({
		currentPage: z.number(),
		perPage: z.number(),
		totalPages: z.number(),
		totalCount: z.number(),
	}),
	links: z.object({
		self: z.string(),
		first: z.string(),
		last: z.string(),
	}),
});
export type FavoritedPlaceIdsApi = z.infer<typeof FavoritedPlaceIdsApi>;

export const GreatDivideStatsApi = z.object({
	id: z.number().int().positive(),
	team: z.enum(["phantoms", "cobras"]),
	rank: z.enum([
		"recruit",
		"corporal",
		"sergeant",
		"lieutenant",
		"team captain",
	]),
	kills: z.int().nonnegative(),
	deaths: z.int().nonnegative(),
	pointsScored: z.int().nonnegative(),
	cashEarned: z.int().nonnegative(),
	flagsCaptured: z.int().nonnegative(),
	flagsReturned: z.int().nonnegative(),
	airdropsCollected: z.int().nonnegative(),
	obelisksDestroyed: z.int().nonnegative(),
	blocksPlaced: z.int().nonnegative(),
	blocksDestroyed: z.int().nonnegative(),
	headshots: z.int().nonnegative(),
	//enlistedAt: z.string(),
	lastRoundSeen: z.int().nonnegative(),
});
export type GreatDivideStatsApi = z.infer<typeof GreatDivideStatsApi>;

export const VersionOverride = z.object({
	id: z.number(),
	condition: z.object({
		minVersion: z.string().optional(),
		maxVersion: z.string().optional(),
	}),
	flags: z.record(z.string(), z.union([z.boolean(), z.number(), z.string()])),
	note: z.string().optional(),
});
export const VersionOverridesSchema = z.array(VersionOverride);
export type VersionOverride = z.infer<typeof VersionOverride>;

export const VersionPatch = z.object({
	version: z.string(),
	applied: z.boolean(),
	flags: z
		.record(z.string(), z.union([z.boolean(), z.number(), z.string()]))
		.optional(),
	notes: z.array(z.string()).optional(),
});
export const VersionPatchesSchema = z.array(VersionPatch);
export type VersionPatch = z.infer<typeof VersionPatch>;

export const BlockedTraders = z.object({
	data: z.array(z.number()),
});
export type BlockedTradersApi = z.infer<typeof BlockedTraders>;

export const PublishThemeApi = z.object({
	data: z.object({
		id: z.string(),
		approvalStatus: z.string(),
	}),
});
export type PublishThemeApi = z.infer<typeof PublishThemeApi>;

const PendingTheme = z.object({
	id: z.string(),
	userId: z.number(),
	name: z.string(),
	accentColor: z.string(),
	navbarColor: z.string(),
	fontFamily: z.string().nullable().optional(),
	customCss: z.string().nullable().optional(),
	backgroundImage: z.string().nullable().optional(),
	approvalStatus: z.string(),
	createdAt: z.string().nullable().optional(),
});
export const AdminPendingThemesApi = z.object({ data: z.array(PendingTheme) });
export type AdminPendingThemesApi = z.infer<typeof AdminPendingThemesApi>;

export const AdminReviewThemeApi = z.object({
	data: z.object({ ok: z.boolean() }),
});
export type AdminReviewThemeApi = z.infer<typeof AdminReviewThemeApi>;

export const AdminDeleteThemeApi = z.object({
	data: z.object({ ok: z.boolean() }),
});
export type AdminDeleteThemeApi = z.infer<typeof AdminDeleteThemeApi>;

export const AdminConfigApi = z.object({ data: ExtensionConfigSchema });
export type AdminConfigApi = z.infer<typeof AdminConfigApi>;

export const AdminConfigListApi = z.object({
	data: z.array(
		z.object({
			version: z.string(),
			data: ExtensionConfigSchema,
			updatedAt: z.string().nullable(),
		}),
	),
});
export type AdminConfigListApi = z.infer<typeof AdminConfigListApi>;

export const AdminDeleteConfigApi = z.object({
	data: z.object({ ok: z.boolean() }),
});
export type AdminDeleteConfigApi = z.infer<typeof AdminDeleteConfigApi>;

export const UnpublishThemeApi = z.object({
	data: z.object({ ok: z.boolean() }),
});
export type UnpublishThemeApi = z.infer<typeof UnpublishThemeApi>;

export const GetPublishedThemeApi = z.object({
	data: z.object({
		id: z.string(),
		userId: z.number(),
		name: z.string(),
		accentColor: z.string(),
		navbarColor: z.string(),
		fontFamily: z.string().nullable().optional(),
		customCss: z.string().nullable().optional(),
		backgroundImage: z.string().nullable().optional(),
		navbarIconColor: z.string().nullable().optional(),
	}),
});
export type GetPublishedThemeApi = z.infer<typeof GetPublishedThemeApi>;

const GalleryTheme = z.object({
	id: z.string(),
	userId: z.number(),
	name: z.string(),
	accentColor: z.string(),
	navbarColor: z.string(),
	fontFamily: z.string().nullable().optional(),
	backgroundImage: z.string().nullable().optional(),
	thumbnailUrl: z.string().nullable().optional(),
});
export const ThemeGalleryApi = z.object({
	data: z.array(GalleryTheme),
	meta: z.object({
		currentPage: z.number(),
		perPage: z.number(),
		totalPages: z.number(),
		totalCount: z.number(),
	}),
});
export type ThemeGalleryApi = z.infer<typeof ThemeGalleryApi>;

export const ReportThemeApi = z.object({
	data: z.object({ ok: z.boolean() }),
});
export type ReportThemeApi = z.infer<typeof ReportThemeApi>;

export const PinnedAchievementsApi = z.object({
	data: z.array(z.number()),
});
export type PinnedAchievementsApi = z.infer<typeof PinnedAchievementsApi>;

export const NFTItems = z.object({
	data: z.array(
		z.object({
			itemId: z.number(),
			serials: z.array(z.number()).nullable(),
		}),
	),
});
export type NFTItemsApi = z.infer<typeof NFTItems>;

export const ItemThumbnailMap = z.object({
	data: z.record(z.string(), z.number().nullable()),
});
export type ItemThumbnailMapApi = z.infer<typeof ItemThumbnailMap>;

const EventItem = z.object({
	id: z.number(),
	name: z.string(),
	thumbnailUrl: z.string(),
});

export const EventForItemApi = z.object({
	data: z.object({
		event: z.object({ id: z.number(), slug: z.string(), name: z.string() }),
		items: z.array(EventItem),
	}),
});
export type EventForItemApi = z.infer<typeof EventForItemApi>;

export const EventsListApi = z.object({
	data: z.array(
		z.object({
			id: z.number(),
			slug: z.string(),
			name: z.string(),
			date: z.string().nullable(),
			link: z.string().nullable(),
		}),
	),
});
export type EventsListApi = z.infer<typeof EventsListApi>;

export const EventItemsApi = z.object({
	data: z.array(EventItem),
});
export type EventItemsApi = z.infer<typeof EventItemsApi>;

const AvatarState = z.object({
	useCharacter: z.boolean(),
	items: z.array(z.union([z.number(), z.string()])),
	clothing: z.array(z.union([z.number(), z.string()])).optional(),
	face: z.union([z.number(), z.string()]).optional(),
	body: z.union([z.number(), z.string()]).optional(),
	tool: z.union([z.number(), z.string()]).optional(),
	headColor: z.string(),
	torsoColor: z.string(),
	leftArmColor: z.string(),
	rightArmColor: z.string(),
	leftLegColor: z.string(),
	rightLegColor: z.string(),
});

const AvatarOutfit = z.object({
	id: z.string(),
	name: z.string(),
	createdAt: z.string(),
	data: AvatarState,
});

export const AvatarOutfitsApi = z.object({
	data: z.array(AvatarOutfit),
});
export type AvatarOutfitsApi = z.infer<typeof AvatarOutfitsApi>;

export const AvatarOutfitApi = z.object({
	data: AvatarOutfit,
});
export type AvatarOutfitApi = z.infer<typeof AvatarOutfitApi>;

const PlaceReviewReply = z.object({
	id: z.string(),
	reviewId: z.string(),
	userId: z.number(),
	username: z.string(),
	thumbnail: z.string().nullable(),
	body: z.string(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

const PlaceReview = z.object({
	id: z.string(),
	placeId: z.number(),
	userId: z.number(),
	username: z.string(),
	thumbnail: z.string().nullable(),
	rating: z.number().min(1).max(5),
	body: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
	replies: z.array(PlaceReviewReply),
});

export const PlaceReviewsApi = z.object({
	data: z.object({
		reviews: z.array(PlaceReview),
		averageRating: z.number().nullable(),
		totalReviews: z.number(),
		myReview: PlaceReview.nullable(),
	}),
});
export type PlaceReviewsApi = z.infer<typeof PlaceReviewsApi>;

export const PlaceReviewApi = z.object({
	data: PlaceReview,
});
export type PlaceReviewApi = z.infer<typeof PlaceReviewApi>;

export const PlaceReviewReplyApi = z.object({
	data: PlaceReviewReply,
});
export type PlaceReviewReplyApi = z.infer<typeof PlaceReviewReplyApi>;

const KilnNotification = z.object({
	id: z.number(),
	userId: z.number(),
	type: z.string(),
	message: z.string(),
	url: z.string(),
	avatarUrl: z.string().nullable(),
	sourceId: z.string(),
	createdAt: z.string(),
	seenAt: z.string().nullable(),
});
export type KilnNotification = z.infer<typeof KilnNotification>;

export const NotificationsApi = z.object({
	data: z.array(KilnNotification),
});
export type NotificationsApi = z.infer<typeof NotificationsApi>;

export const MarkNotificationSeenApi = z.object({
	data: KilnNotification,
});
export type MarkNotificationSeenApi = z.infer<typeof MarkNotificationSeenApi>;

const AuthSession = z.object({
	id: z.string(),
	createdAt: z.string().nullable(),
	expiresAt: z.coerce.date(),
	lastUsedAt: z.coerce.date().nullable(),
	os: z.string().nullable(),
	browser: z.string().nullable(),
});
export const AuthSessionsApi = z.object({ data: z.array(AuthSession) });
export type AuthSessionsApi = z.infer<typeof AuthSessionsApi>;

const ActivitySearchResult = z.object({
	userId: z.number(),
	username: z.string(),
	thumbnailUrl: z.string().nullable(),
	isStaff: z.boolean(),
	userRoleClass: z.string().nullable(),
	registeredAt: z.string(),
	lastSeenAt: z.string(),
});
export const ActivitySearchApi = z.object({
	data: z.array(ActivitySearchResult),
});
export type ActivitySearchApi = z.infer<typeof ActivitySearchApi>;
