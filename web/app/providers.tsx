"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useScenarioStore } from "@/lib/store";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => makeQueryClient());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    useScenarioStore.persist.rehydrate();
    setHydrated(true);
  }, []);

  return (
    <QueryClientProvider client={client}>
      {hydrated ? children : null}
    </QueryClientProvider>
  );
}
