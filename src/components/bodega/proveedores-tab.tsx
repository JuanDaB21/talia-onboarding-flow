import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ResponsiveSheet } from "./responsive-sheet";
import { ProveedorForm } from "./proveedor-form";

interface Proveedor {
  id_proveedor: string;
  razon_social: string;
  documento_tributario: string;
  nombre_contacto: string;
  telefono: string;
  estado: boolean;
}

export function ProveedoresTab({ idNegocio }: { idNegocio: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("proveedores")
      .select("id_proveedor, razon_social, documento_tributario, nombre_contacto, telefono, estado")
      .order("created_at", { ascending: false });
    setItems((data as Proveedor[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [idNegocio]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Proveedores</h2>
          <p className="text-sm text-muted-foreground">
            Personas o empresas a las que compras insumos.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Nuevo
        </Button>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Razón social</TableHead>
              <TableHead className="hidden sm:table-cell">Documento</TableHead>
              <TableHead className="hidden md:table-cell">Contacto</TableHead>
              <TableHead className="hidden md:table-cell">Teléfono</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                  Aún no hay proveedores. Crea el primero.
                </TableCell>
              </TableRow>
            ) : (
              items.map((p) => (
                <TableRow key={p.id_proveedor}>
                  <TableCell className="font-medium">
                    <Link
                      to="/bodega/proveedores/$id"
                      params={{ id: p.id_proveedor }}
                      className="hover:underline"
                    >
                      {p.razon_social}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{p.documento_tributario}</TableCell>
                  <TableCell className="hidden md:table-cell">{p.nombre_contacto}</TableCell>
                  <TableCell className="hidden md:table-cell">{p.telefono}</TableCell>
                  <TableCell>
                    <Badge variant={p.estado ? "default" : "secondary"}>
                      {p.estado ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ResponsiveSheet
        open={open}
        onOpenChange={setOpen}
        title="Nuevo proveedor"
        description="Registra a una persona o empresa que te suministra insumos."
      >
        <ProveedorForm
          idNegocio={idNegocio}
          onSuccess={() => {
            setOpen(false);
            load();
          }}
          onCancel={() => setOpen(false)}
        />
      </ResponsiveSheet>
    </div>
  );
}
