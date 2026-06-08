import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_app/configuracion/bonos-descuentos")({
  head: () => ({ meta: [{ title: "Bonos y descuentos — Talia" }] }),
  component: BonosDescuentosPage,
});

function BonosDescuentosPage() {
  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/configuracion">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a Configuración
          </Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Ticket className="h-5 w-5" />
          </div>
          <CardTitle>Bonos y descuentos</CardTitle>
          <CardDescription>
            Próximamente: crea bonos, cupones y descuentos aplicables a las cuentas.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Esta sección está en construcción. Aquí podrás definir bonos por monto o porcentaje,
          vigencias y reglas de uso.
        </CardContent>
      </Card>
    </div>
  );
}
