import z from "zod";

export const PolytoriaTradeItemStats = z.object({
	id: z.number(),
	value: z.number().nullable(),
	demand: z.string().nullable(),
	trend: z.string().nullable(),
	funFact: z.string().nullable(),
	valueLow: z.number().nullable(),
	valueHigh: z.number().nullable(),
	valueNote: z.string().nullable(),
	created_at: z.number(),
	updated_at: z.number(),
});

export const PolytoriaTradeItemLatestListing = z.object({
	bestPrice: z.number(),
	sellers: z.number(),
	created_at: z.number(),
});

export const PolytoriaTradeItem = z.object({
	id: z.number(),
	type: z.string(),
	name: z.string(),
	shorthand: z.string().nullable(),
	description: z.string().nullable(),
	thumbnailUrl: z.string().nullable(),
	price: z.number().nullable(),
	recentAverage: z.number().nullable(),
	stock: z.number().nullable(),
	created_at: z.number(),
	updated_at: z.number(),
	stats: PolytoriaTradeItemStats,
	tags: z.array(
		z.object({ id: z.number(), name: z.string(), emoji: z.string() }).partial(),
	),
	latestListing: PolytoriaTradeItemLatestListing.nullish(),
});

export const PolytoriaTradeTag = z.object({
	id: z.number(),
	name: z.string(),
	emoji: z.string(),
});

export const PolytoriaTradeItemWithTagsResult = z.object({
	item: PolytoriaTradeItem,
	allTags: z.array(PolytoriaTradeTag),
	latestListing: PolytoriaTradeItemLatestListing.nullable(),
});

/** Response shape for the polytoria.trade TRPC batch endpoint `getItemWithTags` */
export type PolytoriaTradeItemWithTagsResult = z.infer<
	typeof PolytoriaTradeItemWithTagsResult
>;

export const PolytoriaTradeBatchResponse = z.array(
	z.object({
		result: z.object({
			data: PolytoriaTradeItemWithTagsResult,
		}),
	}),
);
export type PolytoriaTradeBatchResponse = z.infer<
	typeof PolytoriaTradeBatchResponse
>;
export type PolytoriaTradeItem = z.infer<typeof PolytoriaTradeItem>;
export type PolytoriaTradeItemStats = z.infer<typeof PolytoriaTradeItemStats>;

export const PolytoriaTradeOwnerHistory = z.array(
	z.object({
		result: z.object({
			data: z.array(
				z.object({
					id: z.number(),
					itemId: z.number(),
					serial: z.number(),
					userId: z.number(),
					username: z.string(),
					isFirst: z.boolean(),
					created_at: z.number(),
				}),
			),
		}),
	}),
);
export type PolytoriaTradeOwnerHistory = z.infer<
	typeof PolytoriaTradeOwnerHistory
>;
