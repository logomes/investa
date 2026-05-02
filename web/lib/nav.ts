import {
  LayoutGrid,
  Home,
  LineChart,
  Target,
  Receipt,
  Dices,
  Download,
  Vault,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  slug: string;
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  fase: number;
};

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "ANÁLISE",
    items: [
      { slug: "", label: "Visão Geral", href: "/", icon: LayoutGrid, fase: 3 },
      { slug: "imovel", label: "Imóvel", href: "/imovel", icon: Home, fase: 5 },
      { slug: "carteira", label: "Carteira", href: "/carteira", icon: LineChart, fase: 5 },
      { slug: "sensibilidade", label: "Sensibilidade", href: "/sensibilidade", icon: Target, fase: 5 },
      { slug: "tributacao", label: "Tributação", href: "/tributacao", icon: Receipt, fase: 5 },
      { slug: "risco", label: "Risco MC", href: "/risco", icon: Dices, badge: "MC", fase: 5 },
      { slug: "exportar", label: "Exportar", href: "/exportar", icon: Download, fase: 5 },
      { slug: "renda-fixa", label: "Renda Fixa", href: "/renda-fixa", icon: Vault, fase: 5 },
    ],
  },
];

export const NAV_BY_HREF: Record<string, NavItem> = Object.fromEntries(
  NAV_GROUPS.flatMap((g) => g.items).map((i) => [i.href, i] as const)
);
