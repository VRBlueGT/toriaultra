// Auto-generated from entrypoints (do not edit manually!)
// Regenerated on every `bun install`, `dev`, and `build`.

export const PATH_FEATURES = {
	"https://polytoria.com/*": [
		"friendReqNotifActions",
		"hideNotificationBadges",
		"hideUserAds",
		"irlBrickPrice",
		"legacySidebar",
		"localizedTimestamps",
		"membershipThemes",
		"reenableSearch",
		"stickyNavbar",
		"themeCreator",
		"userAliases"
	],
	"https://polytoria.com/": [
		"bestFriends",
		"creatorCommentLabels",
		"dailyChallengesRefreshing",
		"disableInfiniteScrolling",
		"favoritedPlaces",
		"homeFriendJoins",
		"irlBrickPrice",
		"quickCreatorLaunchBtns"
	],
	"https://polytoria.com/create/place/*": [
		"activeChallengesDisplay",
		"autoRefreshData",
		"creatorCommentLabels",
		"detailedPlaceReviews",
		"disableInfiniteScrolling",
		"favoritedPlaces",
		"improvedAchievements",
		"legacyWorldViewLayout",
		"placeConsumablesTab",
		"placeManagement",
		"placeRevenue",
		"playtimeTracking",
		"randomPlace",
		"serverRefreshing",
		"serverShareLinks",
		"subtleV2Labels"
	],
	"https://polytoria.com/forum": [
		"advancedForumSearch",
		"aiBotForumWarnings",
		"forumMentions",
		"improvedForumComposer",
		"myPosts"
	],
	"https://polytoria.com/forum/*": [
		"advancedForumSearch",
		"aiBotForumWarnings",
		"forumMentions",
		"improvedForumComposer",
		"myPosts"
	],
	"https://polytoria.com/guilds/*": [
		"creatorCommentLabels"
	],
	"https://polytoria.com/home": [
		"bestFriends",
		"dailyChallengesRefreshing",
		"disableInfiniteScrolling",
		"favoritedPlaces",
		"homeFriendJoins",
		"irlBrickPrice",
		"quickCreatorLaunchBtns"
	],
	"https://polytoria.com/inbox": [
		"messagePreviewExpand"
	],
	"https://polytoria.com/library": [
		"audioToolboxPreviews",
		"modelTreeInspector"
	],
	"https://polytoria.com/models/*": [
		"audioToolboxPreviews",
		"modelTreeInspector"
	],
	"https://polytoria.com/my/*": [
		"avatarSandbox",
		"customBodyColorHexCodes",
		"improvedFriendLists",
		"irlBrickPrice"
	],
	"https://polytoria.com/places/*": [
		"activeChallengesDisplay",
		"autoRefreshData",
		"creatorCommentLabels",
		"detailedPlaceReviews",
		"disableInfiniteScrolling",
		"favoritedPlaces",
		"improvedAchievements",
		"legacyWorldViewLayout",
		"placeConsumablesTab",
		"placeManagement",
		"placeRevenue",
		"playtimeTracking",
		"randomPlace",
		"serverRefreshing",
		"serverShareLinks",
		"subtleV2Labels"
	],
	"https://polytoria.com/store/*": [
		"accurateOwners",
		"backClothingView",
		"collectibleOwnerLabels",
		"creatorCommentLabels",
		"disableInfiniteScrolling",
		"eventItems",
		"hoardersList",
		"irlBrickPrice",
		"legacyItemViewLayout",
		"loveIntegration",
		"mySerial",
		"nftItems",
		"recentCollectibleTransactions",
		"storeOwnedTags"
	],
	"https://polytoria.com/trade/*": [
		"blockedTraders",
		"irlBrickPrice",
		"nftItems",
		"quickCancelOutboundTrades",
		"quickCounterTrades",
		"tradeManager"
	],
	"https://polytoria.com/u/*": [
		"avatarMeshDownloader",
		"avatarVersions",
		"basicBlockedInfo",
		"classicAvatarPerspective",
		"collectibleOwnerLabels",
		"inventoryCollectibles",
		"outfitCost",
		"pinnedAchievements",
		"rankingPositions",
		"tgdStats",
		"userAliases",
		"userCreationsTab",
		"userIdDisplay",
		"userNotes"
	],
	"https://polytoria.com/users": [
		"avatarMeshDownloader",
		"avatarVersions",
		"basicBlockedInfo",
		"classicAvatarPerspective",
		"collectibleOwnerLabels",
		"inventoryCollectibles",
		"outfitCost",
		"pinnedAchievements",
		"rankingPositions",
		"tgdStats",
		"userAliases",
		"userCreationsTab",
		"userIdDisplay",
		"userNotes"
	],
	"https://polytoria.com/users/*": [
		"avatarMeshDownloader",
		"avatarVersions",
		"basicBlockedInfo",
		"classicAvatarPerspective",
		"collectibleOwnerLabels",
		"inventoryCollectibles",
		"outfitCost",
		"pinnedAchievements",
		"rankingPositions",
		"tgdStats",
		"userAliases",
		"userCreationsTab",
		"userIdDisplay",
		"userNotes"
	]
} as const;

export type FeaturePath = keyof typeof PATH_FEATURES;
