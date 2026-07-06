import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  usuarioCreateSchema,
  usuarioUpdateSchema,
  type RolStaffUi,
  type UsuarioCreateInput,
  type UsuarioUpdateInput,
} from "@/lib/configuracion-schemas";
import { crearUsuarioStaff, actualizarUsuarioStaff } from "@/lib/usuarios.functions";
import { useEspacios } from "@/hooks/use-espacios";

interface ExistingUsuario {
  id_usuario: string;
  nombre: string;
  correo: string;
  rol: RolStaffUi;
  id_espacio_asignado: string | null;
  estado: boolean;
  recibe_propinas: boolean;
}

interface Props {
  usuario: ExistingUsuario | null;
  onSuccess: () => void;
  onCancel: () => void;
  onDelete?: () => void | Promise<void>;
}

const ROLES_BASE: RolStaffUi[] = ["ADMIN", "CAJERO", "MESERO"];

export function UsuarioForm({ usuario, onSuccess, onCancel, onDelete }: Props) {
  const isEdit = Boolean(usuario);
  const [deleting, setDeleting] = useState(false);
  const crear = useServerFn(crearUsuarioStaff);
  const actualizar = useServerFn(actualizarUsuarioStaff);
  const { espacios } = useEspacios({ soloActivos: true });

  type FormValues = UsuarioCreateInput | UsuarioUpdateInput;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(isEdit ? usuarioUpdateSchema : usuarioCreateSchema) as never,
    defaultValues: isEdit
      ? {
          nombre: usuario!.nombre,
          rol: usuario!.rol,
          id_espacio_asignado: usuario!.id_espacio_asignado,
          estado: usuario!.estado,
          recibe_propinas: usuario!.recibe_propinas,
          password: "",
        }
      : {
          nombre: "",
          correo: "",
          password: "",
          rol: "MESERO",
          id_espacio_asignado: null,
          estado: true,
          recibe_propinas: false,
        },
  });

  const estado = watch("estado");
  const rol = watch("rol");
  const idEspacio = watch("id_espacio_asignado") ?? null;
  const recibePropinas = watch("recibe_propinas");

  // Construir opciones de "rol" como combinación de roles base + una opción por espacio activo.
  // Internamente: COCINA/BARRA siguen su rol homónimo; otros espacios → rol=ESTACION + id_espacio.
  type RolOption =
    | { kind: "base"; value: RolStaffUi; label: string }
    | {
        kind: "espacio";
        value: string;
        label: string;
        slug: string;
        idEspacio: string;
        rol: RolStaffUi;
      };

  const opciones: RolOption[] = [
    ...ROLES_BASE.map((r) => ({ kind: "base" as const, value: r, label: r })),
    ...espacios.map((e) => ({
      kind: "espacio" as const,
      value: `ESP:${e.id_espacio}`,
      label: `Estación · ${e.nombre}`,
      slug: e.slug,
      idEspacio: e.id_espacio,
      rol: (e.slug === "COCINA"
        ? "COCINA"
        : e.slug === "BARRA"
          ? "BARRA"
          : "ESTACION") as RolStaffUi,
    })),
  ];

  const currentValue: string = (() => {
    if (rol === "COCINA" || rol === "BARRA" || rol === "ESTACION") {
      const match = opciones.find((o) => o.kind === "espacio" && o.idEspacio === idEspacio);
      if (match) return match.value;
      // Fallback por slug si no se ha cargado el espacio
      const bySlug = opciones.find(
        (o) =>
          o.kind === "espacio" &&
          o.slug === (rol === "COCINA" ? "COCINA" : rol === "BARRA" ? "BARRA" : ""),
      );
      if (bySlug) return bySlug.value;
    }
    return rol;
  })();

  const handleRolChange = (val: string) => {
    const opt = opciones.find((o) => o.value === val);
    if (!opt) return;
    if (opt.kind === "base") {
      setValue("rol", opt.value, { shouldDirty: true });
      setValue("id_espacio_asignado", null, { shouldDirty: true });
    } else {
      setValue("rol", opt.rol, { shouldDirty: true });
      setValue("id_espacio_asignado", opt.idEspacio, { shouldDirty: true });
    }
  };

  const onSubmit = async (values: FormValues) => {
    try {
      if (isEdit && usuario) {
        const v = values as UsuarioUpdateInput;
        await actualizar({
          data: {
            id_usuario: usuario.id_usuario,
            nombre: v.nombre,
            rol: v.rol,
            id_espacio_asignado: v.id_espacio_asignado ?? null,
            estado: v.estado,
            recibe_propinas: v.recibe_propinas,
            password: v.password || undefined,
          },
        });
        toast.success("Usuario actualizado");
      } else {
        const v = values as UsuarioCreateInput;
        await crear({
          data: {
            ...v,
            id_espacio_asignado: v.id_espacio_asignado ?? null,
          },
        });
        toast.success("Usuario creado");
      }
      onSuccess();
    } catch (e) {
      toast.error("No se pudo guardar", { description: (e as Error).message });
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="nombre">Nombre</Label>
        <Input id="nombre" {...register("nombre")} />
        {errors.nombre && (
          <p className="text-xs text-destructive">{errors.nombre.message as string}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="correo">Correo</Label>
        <Input
          id="correo"
          type="email"
          readOnly={isEdit}
          defaultValue={isEdit ? usuario!.correo : undefined}
          {...(isEdit ? {} : register("correo" as never))}
        />
        {!isEdit && (errors as Record<string, { message?: string }>).correo && (
          <p className="text-xs text-destructive">
            {(errors as Record<string, { message?: string }>).correo.message}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">
          Contraseña {isEdit && <span className="text-muted-foreground text-xs">(opcional)</span>}
        </Label>
        <Input
          id="password"
          type="password"
          placeholder={isEdit ? "Dejar en blanco para no cambiar" : ""}
          {...register("password")}
        />
        {errors.password && (
          <p className="text-xs text-destructive">{errors.password.message as string}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>Rol</Label>
        <Select value={currentValue} onValueChange={handleRolChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {opciones.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(errors as Record<string, { message?: string }>).id_espacio_asignado && (
          <p className="text-xs text-destructive">
            {(errors as Record<string, { message?: string }>).id_espacio_asignado.message}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between rounded-md border p-3">
        <div>
          <Label htmlFor="estado">Estado activo</Label>
          <p className="text-xs text-muted-foreground">Puede iniciar sesión.</p>
        </div>
        <Switch
          id="estado"
          checked={estado}
          onCheckedChange={(v) => setValue("estado", v, { shouldDirty: true })}
        />
      </div>

      <div className="flex items-center justify-between rounded-md border p-3">
        <div>
          <Label htmlFor="recibe_propinas">Recibe propinas</Label>
          <p className="text-xs text-muted-foreground">
            Entra al reparto equitativo por día de turno.
          </p>
        </div>
        <Switch
          id="recibe_propinas"
          checked={recibePropinas}
          onCheckedChange={(v) => setValue("recibe_propinas", v, { shouldDirty: true })}
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-2 pt-2">
        <Button type="button" variant="outline" className="w-full sm:flex-1" onClick={onCancel}>
          Cancelar
        </Button>
        {isEdit && onDelete && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="destructive"
                className="w-full sm:w-auto"
                disabled={deleting}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Eliminar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción no se puede deshacer. La cuenta y el acceso del usuario serán
                  eliminados de forma permanente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} disabled={deleting}>
                  {deleting ? "Eliminando…" : "Eliminar"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        <Button
          type="submit"
          className="w-full sm:flex-1"
          disabled={isSubmitting || (isEdit && !isDirty)}
        >
          {isSubmitting ? "Guardando…" : isEdit ? "Guardar cambios" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
