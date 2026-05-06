"use client";

import { useEffect, useRef, useState } from "react";
import { useAssetsStore } from "@/lib/ativos-store";
import { useMacro } from "@/lib/api";
import { ativosKpis, byAssetClass, byMarket } from "@/lib/ativos-derive";
import { exportCsv, importCsv } from "@/lib/ativos-csv";
import { ErrorCard } from "@/components/error/ErrorCard";
import { KpiSkeleton } from "@/components/kpi/KpiSkeleton";
import { AssetsTable } from "./AssetsTable";
import { AssetDialog } from "./AssetDialog";
import { KpiRowAtivos } from "./KpiRowAtivos";
import { ByAssetClassCard } from "./ByAssetClassCard";
import { ByMarketCard } from "./ByMarketCard";
import type { AssetPosition } from "@/lib/ativos-schema";

function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function AtivosPageContent() {
  const positions = useAssetsStore((s) => s.positions);
  const upsert = useAssetsStore((s) => s.upsertPosition);
  const remove = useAssetsStore((s) => s.removePosition);
  const replaceAll = useAssetsStore((s) => s.replaceAllPositions);
  const macro = useMacro();
  const fileRef = useRef<HTMLInputElement>(null);
  const [hydrated, setHydrated] = useState(false);
  const [dialog, setDialog] = useState<{ open: boolean; mode: "add" | "edit"; initial?: AssetPosition }>({
    open: false,
    mode: "add",
  });

  useEffect(() => {
    useAssetsStore.persist.rehydrate();
    setHydrated(true);
  }, []);

  if (!hydrated || macro.isLoading) {
    return (
      <div className="grid grid-cols-4 gap-4">
        <KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton />
      </div>
    );
  }
  if (macro.error) return <ErrorCard onRetry={() => macro.refetch()} />;

  const kpis = ativosKpis(positions, macro.data!);
  const groups = byAssetClass(positions, macro.data!);
  const split = byMarket(positions, macro.data!);

  return (
    <div className="space-y-6">
      <KpiRowAtivos kpis={kpis} />
      <AssetsTable
        positions={positions}
        macro={macro.data!}
        onAdd={() => setDialog({ open: true, mode: "add" })}
        onEdit={(p) => setDialog({ open: true, mode: "edit", initial: p })}
        onDelete={remove}
        onImport={() => fileRef.current?.click()}
        onExport={() => downloadFile(exportCsv(positions), "ativos.csv")}
      />
      <input
        ref={fileRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const result = await importCsv(file);
          if (result.positions.length > 0) replaceAll(result.positions);
          if (result.errors.length > 0) console.warn("Erros importação:", result.errors);
          if (e.target) e.target.value = "";
        }}
      />
      <div className="grid grid-cols-2 gap-6">
        <ByAssetClassCard groups={groups} />
        <ByMarketCard split={split} macro={macro.data!} />
      </div>
      <AssetDialog
        open={dialog.open}
        mode={dialog.mode}
        initial={dialog.initial}
        onClose={() => setDialog({ open: false, mode: "add" })}
        onSubmit={(p) => {
          upsert(p);
          setDialog({ open: false, mode: "add" });
        }}
        onDelete={remove}
      />
    </div>
  );
}
