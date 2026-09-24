import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { instalarGuardTraductor } from "@/lib/guard-traductor";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Ir al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Ir al inicio
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Talia tu IA para restaurantes" },
      { name: "description", content: "Talia Restaurant Hub is a SaaS application for restaurant management." },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Talia tu IA para restaurantes" },
      { property: "og:description", content: "Talia Restaurant Hub is a SaaS application for restaurant management." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Talia tu IA para restaurantes" },
      { name: "twitter:description", content: "Talia Restaurant Hub is a SaaS application for restaurant management." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/78559db7-6e46-4998-b973-44835297c2d4" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/78559db7-6e46-4998-b973-44835297c2d4" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

// Rutas del comensal (carta pública y carta QR): se dejan traducir para turistas. Los nombres de
// productos/categorías/negocio van blindados con <TextoFijo> (components/menu-publico/texto-fijo.tsx).
function esCartaPublica(pathname: string) {
  return pathname.startsWith("/carta/") || pathname.startsWith("/carta-publica/");
}

function RootShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const permiteTraducir = esCartaPublica(pathname);
  return (
    // lang="es": la app es 100% en español. Fuera de la carta, translate="no" + meta
    // `notranslate`: Chrome Android traducía el panel y Translate envuelve los nodos de texto
    // en <font> y re-parenta hermanos, así que React perdía sus referencias de DOM y reventaba
    // con "insertBefore ... no es un hijo de este nodo" (p. ej. el QR de transferencia).
    <html lang="es" translate={permiteTraducir ? undefined : "no"}>
      <head>
        {!permiteTraducir && <meta name="google" content="notranslate" />}
        <HeadContent />
      </head>
      <body className={permiteTraducir ? undefined : "notranslate"}>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  // Red de seguridad para cuando el traductor sí actúa (la carta, o navegadores que ignoran
  // `notranslate`): evita que React reviente al tocar nodos que el traductor movió.
  useEffect(() => {
    instalarGuardTraductor();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  );
}
