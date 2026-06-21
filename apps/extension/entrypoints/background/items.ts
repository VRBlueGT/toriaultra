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

import { Polytoria } from "@kiln/schemas";
import { onMessage } from "@/utils/messaging";
import { pullKVCache } from "@/utils/utilities";
import { handle, safeFetch, withApi } from "./shared";

onMessage("getStore", ({ data: params }) =>
	handle(async () => {
		const config = await withApi("public_api", "public");
		return safeFetch(
			`${config.resolvedUrls.public}store/?order=${params.order}&sort=${params.sort}&showOffsale=${params.showOffsale}${(params.types || []).map((type) => `&types[]=${type}`)}&search=${params.search}&page=${params.page || 1}${params.limit !== undefined ? `&limit=${params.limit}` : ""}`,
			Polytoria.StoreApiSchema,
		);
	}),
);

onMessage("getItem", ({ data: id }) =>
	handle(async () => {
		const config = await withApi("public_api", "public");
		return pullKVCache(
			"items",
			String(id),
			() =>
				safeFetch(
					`${config.resolvedUrls.public}store/${id}`,
					Polytoria.ItemApiSchema,
				),
			10 * 60 * 1000,
			false,
		);
	}),
);

onMessage("getItemMesh", ({ data: id }) =>
	handle(async () => {
		const config = await withApi("public_api", "public");
		return safeFetch(
			`${config.resolvedUrls.public}assets/serve-mesh/${id}`,
			Polytoria.MeshApiSchema,
		);
	}),
);

onMessage("getItemTexture", ({ data: id }) =>
	handle(async () => {
		const config = await withApi("public_api", "public");
		return safeFetch(
			`${config.resolvedUrls.public}assets/serve/${id}/Asset`,
			Polytoria.MeshApiSchema,
		);
	}),
);

onMessage("getItemOwners", ({ data: { itemId, limit } }) =>
	handle(async () => {
		const config = await withApi("public_api", "public");
		const cacheKey =
			limit !== undefined ? `${itemId}-${limit}` : `${itemId}-all`;
		return pullKVCache(
			"ownerCount",
			cacheKey,
			async () => {
				const BATCH_LIMIT = 100;

				if (limit !== undefined && limit <= BATCH_LIMIT) {
					return safeFetch(
						`${config.resolvedUrls.public}store/${itemId}/owners?limit=${limit}`,
						Polytoria.OwnersApiSchema,
					);
				}

				const firstRes = await safeFetch(
					`${config.resolvedUrls.public}store/${itemId}/owners?limit=${BATCH_LIMIT}&page=1`,
					Polytoria.OwnersApiSchema,
				);

				const total = limit ?? firstRes.total;
				const finalResults = {
					inventories: [...(firstRes.inventories || [])],
					pages: Math.ceil(total / BATCH_LIMIT),
					total: firstRes.total,
				};

				for (let page = 2; page <= finalResults.pages; page++) {
					const currentBatchSize = Math.min(
						BATCH_LIMIT,
						total - (page - 1) * BATCH_LIMIT,
					);
					const res = await safeFetch(
						`${config.resolvedUrls.public}store/${itemId}/owners?limit=${currentBatchSize}&page=${page}`,
						Polytoria.OwnersApiSchema,
					);
					finalResults.inventories.push(...(res.inventories || []));
				}

				return finalResults;
			},
			60 * 1000,
			false,
		);
	}),
);

onMessage("getItemCopy", ({ data: { itemId, userId } }) =>
	handle(async () => {
		const config = await withApi("public_api", "public");
		return pullKVCache(
			"individualOwners",
			`${String(userId)}-${String(itemId)}`,
			() =>
				safeFetch(
					`${config.resolvedUrls.public}store/${itemId}/owner?userID=${userId}`,
					Polytoria.IndividualOwnerApiSchema,
				),
			30 * 1000,
			false,
		);
	}),
);