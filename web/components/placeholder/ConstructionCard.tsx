import { Construction } from "lucide-react";

type Props = {
  pageTitle: string;
  fase: number;
};

export function ConstructionCard({ pageTitle, fase }: Props) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="bg-bg-2 border border-line rounded-card p-8 max-w-md w-full flex flex-col items-center text-center">
        <div className="w-12 h-12 rounded-full bg-bg-3 flex items-center justify-center mb-4">
          <Construction className="w-6 h-6 text-brand-bright" />
        </div>
        <h2 className="text-lg font-semibold text-ink mb-2">Em construção</h2>
        <p className="text-sm text-ink-2 mb-1">
          A aba <span className="text-ink font-medium">{pageTitle}</span> ficará disponível na <span className="text-brand-bright font-medium">Fase {fase}</span>.
        </p>
        <p className="text-xs text-ink-3">
          Próximas fases vão preencher KPIs, gráficos e tabelas.
        </p>
      </div>
    </div>
  );
}
