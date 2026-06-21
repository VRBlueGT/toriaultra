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

import type { Extension, Polytoria } from "@kiln/schemas";

export type ApiTypes =
	| "public"
	| "internal"
	| "extension"
	| "proxy"
	| "currencyRates";

export type ErrorCode =
	| "API_DISABLED"
	| "RATE_LIMITED"
	| "NO_SESSION"
	| "UNKNOWN";
export type Ok<T> = { ok: true; data: T };
export type Err = { ok: false; code: ErrorCode; message: string };
export type Result<T> = Ok<T> | Err;

export type ApiSession = {
	userId: number;
	state: "pending" | "verified";
	accessToken?: string;
	refreshToken?: string;
	verificationToken?: string;
	phrase?: string;
};

export type CurrencyCode = string;

export type UserDetails = {
	username: string;
	userId: number;
	bricks: number;
	getAvatar: () => Promise<Polytoria.AvatarApi> | Promise<"unavailable">;
};

export interface CacheInterface {
	remoteConfig: Record<string, any> | null;
	favoritedPlaces: Record<string, Polytoria.PlaceApi[]>;
	bestFriends: Record<string, any>;
	inventory: Record<string, any>;
	users: Record<string, Polytoria.UserApi>;
	userIDs: Record<string, number>;
	avatars: Record<string, Polytoria.AvatarApi>;
	items: Record<string, Polytoria.ItemApi>;
	places: Record<string, Polytoria.PlaceApi>;
	placeGamepasses: Record<string, any>;
	placeRevenue: Record<string, number>;
	ownerCount: Record<string, number>;
	greatDivideStats: Record<string, Extension.GreatDivideStatsApi>;
	lastDailyActiveUser: string | null;
	collectibles: Record<number, Polytoria.InventoryApi["inventory"]>;
	[key: string]: any;
}

export interface CacheMetadata {
	favoritedPlaces: number;
	[key: string]: any;
}

export type FormattedHoarder = {
	user: {
		id: number;
		name: string;
		thumbnail?: string;
	};
	copies: number;
	serials: number[];
};

export type AvatarSandboxOutfit = {
	name: string;
	createdAt: number;
	data: AvatarIFrameState;
};

export type AvatarIFrameState = {
	useCharacter: boolean;
	items: (number | string)[];
	clothing?: (number | string)[];
	face?: number | string;
	body?: number | string;
	tool?: number | string;
	headColor: string;
	torsoColor: string;
	leftArmColor: string;
	rightArmColor: string;
	leftLegColor: string;
	rightLegColor: string;
};

export type TradeItem = {
	storeId: number;
	serial: number | null;
	brickValue: number;
	thumbnailUrl: string;
};

export type TradeSide = {
	username: string;
	items: TradeItem[];
	totalValue: number;
	bricksAdded: number;
	bricksAfterFees: number;
	netValue: number;
};

export type TradeStatus = "pending" | "accepted" | "declined" | "canceled";

export type EffectSlot =
	| "global"
	| "cards"
	| "buttons"
	| "inputs"
	| "navbar"
	| "modals"
	| "avatars";
export type EffectType =
	| "border-radius"
	| "box-shadow"
	| "border-width"
	| "border-color"
	| "border-style"
	| "background-color"
	| "letter-spacing"
	| "text-transform"
	| "frame-image"
	| "frame-shape";

export type ThemeEffect = {
	id: string;
	slot: EffectSlot;
	type: EffectType;
	value: string | number;
};

export type EvalProfile = "balanced" | "collector" | "flipper" | "profit";

export type ParsedTrade = {
	status: TradeStatus;
	counterparty: string;
	sides: [TradeSide, TradeSide];
};