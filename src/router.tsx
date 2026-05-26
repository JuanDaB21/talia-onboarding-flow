import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Datos se consideran frescos por 30s → evita refetch en cada mount
        staleTime: 30_000,
        // Mantener en caché 5 min después de desmontar
        gcTime: 5 * 60_000,
        // No refetchear al volver el foco (los presets POLL.* cubren el refresco
        // periódico donde hace falta y realtime invalida lo demás)
        refetchOnWindowFocus: false,
        // Sí refrescar al recuperar conexión
        refetchOnReconnect: "always",
        // Un reintento en error, no varios
        retry: 1,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      },
      mutations: {
        retry: 0,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
