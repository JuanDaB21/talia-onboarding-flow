import { createFileRoute, Link } from "@tanstack/react-router";
import { Users, Utensils, QrCode, Palette, Ticket, Coins } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const SECCIONES = [
  {
    to: "/configuracion/usuarios",
    label: "Usuarios",
    description: "Gestiona el staff y sus roles.",
    icon: Users,
  },
  {
    to: "/configuracion/mesas",
    label: "Mesas",
    description: "Crea y administra las mesas del negocio.",
    icon: Utensils,
  },
  {
    to: "/configuracion/metodos-pago",
    label: "Métodos de pago",
    description: "Configura los QR de Nequi, Daviplata y otros.",
    icon: QrCode,
  },
  {
    to: "/configuracion/apariencia",
    label: "Menú público",
    description: "Personaliza la apariencia del menú del cliente.",
    icon: Palette,
  },
  {
    to: "/configuracion/bonos-descuentos",
    label: "Bonos y descuentos",
    description: "Define bonos, cupones y descuentos aplicables.",
    icon: Ticket,
  },
] as const;

export const Route = createFileRoute("/_app/configuracion/")({
  component: ConfiguracionIndex,
});

function ConfiguracionIndex() {
  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Configuración</h1>
        <p className="text-sm text-muted-foreground">
          Administra las opciones de tu negocio.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECCIONES.map((s) => {
          const Icon = s.icon;
          return (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            <Link key={s.to} to={s.to as any} className="group">
              <Card className="h-full transition-colors hover:border-primary hover:bg-accent/40">
                <CardHeader>
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base">{s.label}</CardTitle>
                  <CardDescription>{s.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
