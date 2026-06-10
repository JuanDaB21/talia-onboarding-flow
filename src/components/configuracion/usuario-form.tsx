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
  ROLES_UI,
  usuarioCreateSchema,
  usuarioUpdateSchema,
  type RolStaffUi,
  type UsuarioCreateInput,
  type UsuarioUpdateInput,
} from "@/lib/configuracion-schemas";
import {
  crearUsuarioStaff,
  actualizarUsuarioStaff,
} from "@/lib/usuarios.functions";

interface ExistingUsuario {
  id_usuario: string;
  nombre: string;
  correo: string;
  rol: RolStaffUi;
  estado: boolean;
  recibe_propinas: boolean;
}

interface Props {
  usuario: ExistingUsuario | null;
  onSuccess: () => void;
  onCancel: () => void;
  onDelete?: () => void | Promise<void>;
}

export function UsuarioForm({ usuario, onSuccess, onCancel, onDelete }: Props) {
  const isEdit = Boolean(usuario);
  const [deleting, setDeleting] = useState(false);
  const crear = useServerFn(crearUsuarioStaff);
  const actualizar = useServerFn(actualizarUsuarioStaff);

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
          estado: usuario!.estado,
          recibe_propinas: usuario!.recibe_propinas,
          password: "",
        }
      : {
          nombre: "",
          correo: "",
          password: "",
          rol: "MESERO",
          estado: true,
          recibe_propinas: false,
        },
  });

  const estado = watch("estado");
  const rol = watch("rol");
  const recibePropinas = watch("recibe_propinas");

  const onSubmit = async (values: FormValues) => {
    try {
      if (isEdit && usuario) {
        const v = values as UsuarioUpdateInput;
        await actualizar({
          data: {
            id_usuario: usuario.id_usuario,
            nombre: v.nombre,
            rol: v.rol,
            estado: v.estado,
            recibe_propinas: v.recibe_propinas,
            password: v.password || undefined,
          },
        });
        toast.success("Usuario actualizado");
      } else {
        const v = values as UsuarioCreateInput;
        await crear({ data: v });
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
        <Select
          value={rol}
          onValueChange={(v) => setValue("rol", v as RolStaffUi, { shouldDirty: true })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLES_UI.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
          onCheckedChange={(v) =>
            setValue("recibe_propinas", v, { shouldDirty: true })
          }
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
                  Esta acción no se puede deshacer. La cuenta y el acceso del usuario
                  serán eliminados de forma permanente.
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
