"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Trash2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ASSET_CLASS_META } from "@/lib/ativos-schema";
import type { AssetClass, AssetPosition, Currency } from "@/lib/ativos-schema";
import { fetchQuote, QuoteNotFoundError } from "@/lib/quotes";
import type { QuoteOut } from "@/lib/api-types";

const formSchema = z.object({
  id: z.string(),
  ticker: z.string().min(1, "obrigatório").regex(/^[A-Za-z0-9.]+$/, "letras/números/ponto"),
  assetClass: z.enum([
    "FII_PAPEL", "FII_TIJOLO",
    "ACAO_BR_DIVIDENDO", "ACAO_BR_CRESCIMENTO",
    "ETF_BR", "BDR",
    "STOCK_US", "REIT_US", "ETF_US",
  ]),
  currency: z.enum(["BRL", "USD"]),
  quantity: z.number().positive(),
  avgPrice: z.number().positive(),
  expectedYield: z.number().min(0, "yield 0–100%").max(100, "yield 0–100%"),
  capitalGain: z.number().min(-100, "ganho -100–100%").max(100, "ganho -100–100%"),
  currentPrice: z.number().positive().optional(),
  asOf: z.string().datetime().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const CLASS_OPTIONS: Array<{ value: AssetClass; label: string }> = (
  Object.entries(ASSET_CLASS_META) as Array<[AssetClass, typeof ASSET_CLASS_META[AssetClass]]>
).map(([value, meta]) => ({ value, label: meta.label }));

type QuoteState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: QuoteOut }
  | { status: "error"; message: string };

function relativeTime(iso: string): string {
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `há ${diffMin} min`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.floor(h / 24)} d`;
}

type Props = {
  open: boolean;
  mode: "add" | "edit";
  initial?: AssetPosition;
  onClose: () => void;
  onSubmit: (p: Omit<AssetPosition, "color">) => void;
  onDelete?: (id: string) => void;
};

export function AssetDialog({ open, mode, initial, onClose, onSubmit, onDelete }: Props) {
  const defaultClass: AssetClass = initial?.assetClass ?? "FII_PAPEL";
  const meta = ASSET_CLASS_META[defaultClass];

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      id: initial?.id ?? crypto.randomUUID(),
      ticker: initial?.ticker ?? "",
      assetClass: defaultClass,
      currency: initial?.currency ?? meta.defaultCurrency,
      quantity: initial?.quantity ?? 1,
      avgPrice: initial?.avgPrice ?? 0,
      expectedYield: initial !== undefined ? initial.expectedYield * 100 : meta.defaultYield * 100,
      capitalGain: initial !== undefined ? initial.capitalGain * 100 : meta.defaultCapitalGain * 100,
      currentPrice: initial?.currentPrice,
      asOf: initial?.asOf,
    },
  });

  const [quote, setQuote] = useState<QuoteState>(() => {
    if (initial?.currentPrice && initial.asOf) {
      return {
        status: "success",
        data: {
          ticker: initial.ticker,
          market: ASSET_CLASS_META[initial.assetClass].market,
          price: initial.currentPrice,
          currency: initial.currency,
          asOf: initial.asOf,
          source: "saved",
        },
      };
    }
    return { status: "idle" };
  });
  const fetchSeq = useRef(0);

  useEffect(() => {
    if (open) {
      const cls = initial?.assetClass ?? "FII_PAPEL";
      const m = ASSET_CLASS_META[cls];
      form.reset({
        id: initial?.id ?? crypto.randomUUID(),
        ticker: initial?.ticker ?? "",
        assetClass: cls,
        currency: initial?.currency ?? m.defaultCurrency,
        quantity: initial?.quantity ?? 1,
        avgPrice: initial?.avgPrice ?? 0,
        expectedYield: initial !== undefined ? initial.expectedYield * 100 : m.defaultYield * 100,
        capitalGain: initial !== undefined ? initial.capitalGain * 100 : m.defaultCapitalGain * 100,
        currentPrice: initial?.currentPrice,
        asOf: initial?.asOf,
      });
      if (initial?.currentPrice && initial.asOf) {
        setQuote({
          status: "success",
          data: {
            ticker: initial.ticker,
            market: m.market,
            price: initial.currentPrice,
            currency: initial.currency,
            asOf: initial.asOf,
            source: "saved",
          },
        });
      } else {
        setQuote({ status: "idle" });
      }
    }
  }, [open, initial, form]);

  // Quando classe muda, atualiza moeda/yield/capGain pros defaults da classe.
  const watchedClass = form.watch("assetClass");
  useEffect(() => {
    if (!open || !watchedClass) return;
    const m = ASSET_CLASS_META[watchedClass as AssetClass];
    if (!initial) {
      form.setValue("currency", m.defaultCurrency);
      form.setValue("expectedYield", m.defaultYield * 100);
      form.setValue("capitalGain", m.defaultCapitalGain * 100);
    }
  }, [watchedClass, open, initial, form]);

  async function loadQuote(rawTicker: string, cls: AssetClass) {
    const ticker = rawTicker.trim().toUpperCase();
    if (!ticker || !/^[A-Za-z0-9.]+$/.test(ticker)) {
      setQuote({ status: "idle" });
      return;
    }
    const seq = ++fetchSeq.current;
    setQuote({ status: "loading" });
    try {
      const data = await fetchQuote(ticker, ASSET_CLASS_META[cls].market);
      if (seq !== fetchSeq.current) return; // stale response
      setQuote({ status: "success", data });
      form.setValue("currentPrice", data.price);
      form.setValue("asOf", data.asOf);
    } catch (e) {
      if (seq !== fetchSeq.current) return;
      const message = e instanceof QuoteNotFoundError ? "Cotação não encontrada" : "Cotação indisponível";
      setQuote({ status: "error", message });
      form.setValue("currentPrice", undefined);
      form.setValue("asOf", undefined);
    }
  }

  const handleSubmit = form.handleSubmit((data) => {
    onSubmit({
      ...data,
      ticker: data.ticker.toUpperCase(),
      expectedYield: data.expectedYield / 100,
      capitalGain: data.capitalGain / 100,
    });
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "add" ? "Adicionar posição" : "Editar posição"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="a-ticker">Ticker</Label>
            <Input
              id="a-ticker"
              {...form.register("ticker", {
                onBlur: (e) => loadQuote(e.target.value, form.getValues("assetClass")),
              })}
              placeholder="HGCR11 / JNJ"
            />
            <QuoteStatusLine quote={quote} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="a-class">Classe</Label>
            <Select
              value={form.watch("assetClass")}
              onValueChange={(v) => form.setValue("assetClass", v as AssetClass)}
            >
              <SelectTrigger id="a-class">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLASS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="a-currency">Moeda</Label>
              <Select
                value={form.watch("currency")}
                onValueChange={(v) => form.setValue("currency", v as Currency)}
              >
                <SelectTrigger id="a-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">BRL</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="a-qty">Quantidade</Label>
              <Input
                id="a-qty"
                type="number"
                step="1"
                {...form.register("quantity", { valueAsNumber: true })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="a-price">Preço médio</Label>
              <Input
                id="a-price"
                type="number"
                step="0.01"
                {...form.register("avgPrice", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="a-yield">Yield esperado (%)</Label>
              <Input
                id="a-yield"
                type="number"
                step="0.1"
                {...form.register("expectedYield", { valueAsNumber: true })}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="a-capgain">Ganho capital esperado (%)</Label>
            <Input
              id="a-capgain"
              type="number"
              step="0.1"
              {...form.register("capitalGain", { valueAsNumber: true })}
            />
          </div>

          <DialogFooter className="flex justify-between items-center pt-4 border-t border-line-soft">
            {mode === "edit" && onDelete && initial ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (confirm("Excluir esta posição?")) {
                    onDelete(initial.id);
                    onClose();
                  }
                }}
              >
                <Trash2 className="w-4 h-4 mr-1.5" />
                Excluir
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit">Salvar</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function QuoteStatusLine({ quote }: { quote: QuoteState }) {
  if (quote.status === "idle") return null;
  if (quote.status === "loading") {
    return (
      <p className="text-[12px] text-ink-3 flex items-center gap-1.5" role="status">
        <Loader2 className="w-3 h-3 animate-spin" /> Buscando cotação…
      </p>
    );
  }
  if (quote.status === "error") {
    return <p className="text-[12px] text-ink-3" role="status">{quote.message} — preencher manual</p>;
  }
  const { price, currency, asOf, source } = quote.data;
  const formatted = currency === "BRL"
    ? price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : price.toLocaleString("en-US", { style: "currency", currency: "USD" });
  return (
    <p className="text-[12px] text-ink-2" role="status">
      {formatted} · {relativeTime(asOf)}{source !== "saved" ? ` · via ${source}` : ""}
    </p>
  );
}
