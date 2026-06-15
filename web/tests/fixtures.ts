import type { TaxProjectionOut } from "@/lib/api-types";

/** Minimal taxProjection to satisfy the SimulateOut type in tests that don't read tax fields. */
export const MOCK_TAX_PROJECTION: TaxProjectionOut = {
  rows: [],
  taxPaidByYear: [0, 0],
  exitTaxByYear: [0, 0],
  allTaxedFinal: 0,
};
