import { z } from "zod";

export const indexerSchema = z.enum(["prefixado", "cdi", "selic", "ipca"]);
export type IndexerKind = z.infer<typeof indexerSchema>;

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const colorRegex = /^#[0-9A-Fa-f]{6}$/;

export const positionSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    initialAmount: z.number().positive(),
    purchaseDate: z.string().regex(dateRegex, "use formato YYYY-MM-DD"),
    indexer: indexerSchema,
    rate: z.number(),
    maturityDate: z.string().regex(dateRegex).nullable(),
    isTaxExempt: z.boolean(),
    color: z.string().regex(colorRegex),
  })
  .refine((p) => !p.maturityDate || p.maturityDate > p.purchaseDate, {
    message: "vencimento deve ser posterior à data de aporte",
    path: ["maturityDate"],
  })
  .refine((p) => p.purchaseDate <= new Date().toISOString().slice(0, 10), {
    message: "data de aporte não pode ser futura",
    path: ["purchaseDate"],
  });

export type FixedIncomePosition = z.infer<typeof positionSchema>;
