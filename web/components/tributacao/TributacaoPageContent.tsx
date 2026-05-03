"use client";

import { useSimulate } from "@/lib/api";
import { ErrorCard } from "@/components/error/ErrorCard";
import { KpiSkeleton } from "@/components/kpi/KpiSkeleton";
import { splitTaxRows } from "@/lib/tributacao-derive";
import { KpiRowTributacao } from "./KpiRowTributacao";
import { TaxComparisonChart } from "./TaxComparisonChart";
import { TributacaoTable } from "./TributacaoTable";
import { TaxNotesCard } from "./TaxNotesCard";

export function TributacaoPageContent() {
  const sim = useSimulate();

  if (sim.isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-4">
          <KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton />
        </div>
      </div>
    );
  }

  if (sim.error) {
    return <ErrorCard onRetry={() => sim.refetch()} />;
  }

  const data = sim.data!;
  const { realEstate, portfolio } = splitTaxRows(data.taxComparison);

  if (!realEstate || !portfolio) {
    return <ErrorCard message="Dados de tributação incompletos" onRetry={() => sim.refetch()} />;
  }

  return (
    <div className="space-y-6">
      <KpiRowTributacao realEstate={realEstate} portfolio={portfolio} />
      <TaxComparisonChart realEstate={realEstate} portfolio={portfolio} />
      <TributacaoTable rows={data.taxComparison} />
      <TaxNotesCard />
    </div>
  );
}
