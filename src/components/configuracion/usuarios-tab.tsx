import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
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
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { UsuarioForm } from "./usuario-form";
import { eliminarUsuarioStaff, listarUsuariosStaff } from "@/lib/usuarios.functions";

interface Usuario {
  id_usuario: string;
  nombre: string;
  correo: string;
  rol: "ADMIN" | "CAJERO" | "MESERO" | "COCINA" | "BARRA" | "ESTACION" | "SUPERADMIN";
  estado: "ACTIVO" | "INACTIVO" | "SUSPENDIDO";
  recibe_propinas: boolean;
  id_espacio_asignado: string | null;
}

export function UsuariosTab({ idNegocio }: { idNegocio: string }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Usuario | null>(null);
  const [items, setItems] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listarUsuariosStaff();
      setItems((data ?? []).filter((u) => u.rol !== "SUPERADMIN") as Usuario[]);
    } catch (e) {
      toast.error("No se pudieron cargar los usuarios", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [idNegocio]);

  const openNew = () => {
    setSelected(null);
    setOpen(true);
  };
  const openEdit = (u: Usuario) => {
    setSelected(u);
    setOpen(true);
  };
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setSelected(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Personal</h2>
          <p className="text-sm text-muted-foreground">
            Crea cuentas para mesero, cocina, barra o administradores.
          </p>
        </div>
        <Button onClick={openNew} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Nuevo
        </Button>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead className="hidden sm:table-cell">Correo</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="hidden sm:table-cell">Propinas</TableHead>
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
                  Aún no hay usuarios. Crea el primero.
                </TableCell>
              </TableRow>
            ) : (
              items.map((u) => (
                <TableRow key={u.id_usuario} className="cursor-pointer" onClick={() => openEdit(u)}>
                  <TableCell className="font-medium">{u.nombre}</TableCell>
                  <TableCell className="hidden sm:table-cell">{u.correo}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{u.rol}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.estado === "ACTIVO" ? "default" : "secondary"}>
                      {u.estado === "ACTIVO" ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant={u.recibe_propinas ? "default" : "outline"}>
                      {u.recibe_propinas ? "Sí" : "No"}
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
        onOpenChange={handleOpenChange}
        title={selected ? "Editar usuario" : "Nuevo usuario"}
        description={
          selected ? "Actualiza los datos del usuario." : "Registra a un nuevo miembro del equipo."
        }
      >
        <UsuarioForm
          key={selected?.id_usuario ?? "new"}
          usuario={
            selected
              ? {
                  id_usuario: selected.id_usuario,
                  nombre: selected.nombre,
                  correo: selected.correo,
                  rol: selected.rol === "SUPERADMIN" ? "ADMIN" : selected.rol,
                  id_espacio_asignado: selected.id_espacio_asignado,
                  estado: selected.estado === "ACTIVO",
                  recibe_propinas: selected.recibe_propinas,
                }
              : null
          }
          onSuccess={() => {
            handleOpenChange(false);
            load();
          }}
          onCancel={() => handleOpenChange(false)}
          onDelete={
            selected
              ? async () => {
                  try {
                    await eliminarUsuarioStaff({ id_usuario: selected.id_usuario });
                    toast.success("Usuario eliminado");
                    handleOpenChange(false);
                    load();
                  } catch (e) {
                    toast.error("No se pudo eliminar", {
                      description: (e as Error).message,
                    });
                  }
                }
              : undefined
          }
        />
      </ResponsiveSheet>
    </div>
  );
}
