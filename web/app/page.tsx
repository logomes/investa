import { KpiRow } from "@/components/visao-geral/KpiRow";
import { EvolutionCard } from "@/components/visao-geral/EvolutionCard";
import { GoalCard } from "@/components/visao-geral/GoalCard";
import { MonthlyIncomeCard } from "@/components/visao-geral/MonthlyIncomeCard";
import { ComparativoTable } from "@/components/visao-geral/ComparativoTable";

export default function VisaoGeralPage() {
  return (
    <div className="space-y-6">
      <KpiRow />
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6">
        <EvolutionCard />
        <GoalCard />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MonthlyIncomeCard />
        <ComparativoTable />
      </div>
    </div>
  );
}
