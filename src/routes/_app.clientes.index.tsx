import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, MessageCircle, Users } from "lucide-react";
import { listarClientes, type Cliente } from "@/lib/clientes.functions";
import { useMiStaff } from "@/hooks/use-mi-staff";
import { formatMoney } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";

export const Route = createFileRoute("/_app/clientes/")({
  head: () => ({ meta: [{ title: "Clientes — Talia" }] }),
  component: ClientesPage,
});

/** Deja el teléfono listo para wa.me (indicativo CO por defecto para móviles de 10 dígitos). */
function telefonoWa(telefono: string): string {
  const soloDigitos = telefono.replace(/\D/g, "");
  if (!soloDigitos) return "";
  return soloDigitos.length === 10 ? "57" + soloDigitos : soloDigitos;
}

function ClientesPage() {
  const { rol } = useMiStaff();
  const puedeVer = rol === "ADMIN" || rol === "SUPERADMIN" || rol === "CAJERO";

  const [search, setSearch] = useState("");
  // Debounce simple: la query se dispara con el término, pero solo tras 300ms sin teclear.
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ["clientes", debounced],
    queryFn: () => listarClientes({ search: debounced || undefined }),
    enabled: puedeVer,
  });

  if (!puedeVer) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        No tienes permiso para ver los clientes.
      </div>
    );
  }

  const clientes = data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Users className="h-6 w-6" /> Clientes
        </h1>
        <p className="text-sm text-muted-foreground">
          Directorio de clientes construido a partir de las reservas, agrupado por teléfono.
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Buscar por nombre o teléfono…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead className="text-center">Reservas</TableHead>
              <TableHead>Última reserva</TableHead>
              <TableHead className="text-right">Total abonado</TableHead>
              <TableHead className="text-right">Contacto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : clientes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  {debounced ? "Sin resultados." : "Aún no hay clientes con reservas registradas."}
                </TableCell>
              </TableRow>
            ) : (
              clientes.map((c: Cliente) => {
                const wa = telefonoWa(c.telefono);
                return (
                  <TableRow key={c.telefono}>
                    <TableCell className="font-medium">{c.nombre}</TableCell>
                    <TableCell className="tabular-nums">{c.telefono}</TableCell>
                    <TableCell className="text-center tabular-nums">{c.veces_reservado}</TableCell>
                    <TableCell>{c.ultima_reserva ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(c.total_abonado)}
                    </TableCell>
                    <TableCell className="text-right">
                      {wa ? (
                        <Button asChild variant="outline" size="sm">
                          <a
                            href={`https://wa.me/${wa}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <MessageCircle className="mr-1 h-3.5 w-3.5" /> WhatsApp
                          </a>
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
