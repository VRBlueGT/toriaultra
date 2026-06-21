import z from "zod";

export const UserApiSchema = z.object({
	user: z.object({
		polytoriaId: z.number().int().positive(),
		username: z.string().min(1),
		avatarUrl: z.string(),
	}),
	profileStates: z.array(
		z.object({
			id: z.string(),
			polytoriaId: z.number().int().positive(),
			avatarUrl: z.string().url(),
			username: z.string().min(1),
			aboutText: z.string(),
			forumSignature: z.string().nullable(),
			membership: z.enum(["free", "plus", "plusDeluxe"]),
			isStaff: z.boolean(),
			checksum: z.string(),
			createdAt: z.string(),
		}),
	),
});
export type UserApi = z.infer<typeof UserApiSchema>;

const InfluxRecord = z.object({
	_time: z.string().datetime(),
	_value: z.string(),
	_field: z.string(),
	_measurement: z.string(),
	playerId: z.string(),
});

export const UserChartsApiSchema = z.object({
	networth: z.array(InfluxRecord),
	profileviews: z.array(InfluxRecord),
	visits: z.array(InfluxRecord),
	forumposts: z.array(InfluxRecord),
	sales: z.array(InfluxRecord),
	xp: z.array(InfluxRecord),
});
export type UserChartsApi = z.infer<typeof UserChartsApiSchema>;
