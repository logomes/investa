"use client";

import { useState, useRef } from "react";
import { useFixedIncomeStore } from "@/lib/fi-store";
import { exportCsv, importCsv } from "@/lib/fi-csv";
import { KpiRowFixedIncome } from "./KpiRowFixedIncome";
import { PositionsTable } from "./PositionsTable";
import { PositionDialog } from "./PositionDialog";
import { ByIndexerCard } from "./ByIndexerCard";
import { IrRegressiveCard } from "./IrRegressiveCard";
import { MaturityCalendarCard } from "./MaturityCalendarCard";
import type { FixedIncomePosition } from "@/lib/fi-schema";

export function RendaFixaPageContent() {
  const positions = useFixedIncomeStore((s) => s.positions);
  const upsertPosition = useFixedIncomeStore((s) => s.upsertPosition);
  const removePosition = useFixedIncomeStore((s) => s.removePosition);
  const replaceAllPositions = useFixedIncomeStore((s) => s.replaceAllPositions);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add");
  const [dialogInitial, setDialogInitial] = useState<FixedIncomePosition | undefined>();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAdd = () => {
    setDialogInitial(undefined);
    setDialogMode("add");
    setDialogOpen(true);
  };

  const handleEdit = (p: FixedIncomePosition) => {
    setDialogInitial(p);
    setDialogMode("edit");
    setDialogOpen(true);
  };

  const handleSubmit = (data: Omit<FixedIncomePosition, "color">) => {
    upsertPosition(data);
    setDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    removePosition(id);
    setDialogOpen(false);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const result = importCsv(text);
    if (result.errors.length === 0 && result.positions.length > 0) {
      replaceAllPositions(result.positions);
      alert(`${result.positions.length} posições importadas.`);
    } else if (result.errors.length > 0) {
      const errorList = result.errors
        .slice(0, 5)
        .map((e) => `Linha ${e.row}: ${e.message}`)
        .join("\n");
      alert(`Erros na importação:\n${errorList}${result.errors.length > 5 ? "\n..." : ""}`);
    }
    e.target.value = "";  // allow re-importing same file
  };

  const handleExport = () => {
    const csv = exportCsv(positions);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `renda-fixa-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <KpiRowFixedIncome />
      <PositionsTable
        positions={positions}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onImportCsv={handleImportClick}
      />
      {positions.length > 0 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleExport}
            className="text-[12px] text-ink-3 hover:text-brand-bright underline"
          >
            Exportar CSV
          </button>
        </div>
      )}
      <div className="grid grid-cols-3 gap-6">
        <ByIndexerCard />
        <IrRegressiveCard />
        <MaturityCalendarCard />
      </div>
      <PositionDialog
        open={dialogOpen}
        mode={dialogMode}
        initial={dialogInitial}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
        onDelete={handleDelete}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
