"use client";

import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useScenarioStore } from "@/lib/store";
import { scenarioFormSchema, type ScenarioFormValues } from "./schema";
import { CapitalSection } from "./sections/CapitalSection";
import { RealEstateSection } from "./sections/RealEstateSection";
import { FinancingSection } from "./sections/FinancingSection";
import { PortfolioSection } from "./sections/PortfolioSection";
import { BenchmarkSection } from "./sections/BenchmarkSection";
import { MonteCarloSection } from "./sections/MonteCarloSection";

export function ScenarioDrawer() {
  const drawerOpen = useScenarioStore((s) => s.drawerOpen);
  const setDrawerOpen = useScenarioStore((s) => s.setDrawerOpen);
  const scenario = useScenarioStore((s) => s.scenario);
  const mc = useScenarioStore((s) => s.mc);
  const setScenario = useScenarioStore((s) => s.setScenario);
  const setMc = useScenarioStore((s) => s.setMc);

  const form = useForm<ScenarioFormValues>({
    resolver: zodResolver(scenarioFormSchema),
    defaultValues: { ...scenario, mc },
  });

  // Re-seed defaults whenever the drawer reopens (in case localStorage changed externally)
  useEffect(() => {
    if (drawerOpen) {
      form.reset({ ...scenario, mc });
    }
  }, [drawerOpen, scenario, mc, form]);

  const onSubmit = form.handleSubmit((data) => {
    const { mc: mcOnly, ...scenarioOnly } = data;
    setScenario(scenarioOnly);
    setMc(mcOnly);
    setDrawerOpen(false);
  });

  return (
    <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
      <SheetContent className="w-full sm:max-w-[480px] overflow-y-auto bg-bg-1 border-l-line">
        <SheetHeader>
          <SheetTitle className="text-ink">Simular cenário</SheetTitle>
        </SheetHeader>
        <FormProvider {...form}>
          <form onSubmit={onSubmit} className="space-y-6 px-5 pb-4">
            <CapitalSection />
            <RealEstateSection />
            <FinancingSection />
            <PortfolioSection />
            <BenchmarkSection />
            <MonteCarloSection />

            <div className="flex justify-end gap-2 pt-4 border-t border-line-soft">
              <Button type="button" variant="outline" onClick={() => setDrawerOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Aplicar cenário</Button>
            </div>
          </form>
        </FormProvider>
      </SheetContent>
    </Sheet>
  );
}
