import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, ArrowLeft, ArrowRight, Check } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import {
  step1Schema,
  step2Schema,
  type Step1Values,
  type Step2Values,
} from "@/lib/register-schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Crear cuenta — Talia" },
      {
        name: "description",
        content:
          "Registra tu restaurante en Talia y obtén tu panel de administración.",
      },
    ],
  }),
  component: RegisterPage,
});

function Stepper({ step }: { step: 1 | 2 }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
        <span className={step >= 1 ? "text-foreground" : ""}>1. Cuenta</span>
        <span className={step >= 2 ? "text-foreground" : ""}>2. Negocio</span>
      </div>
      <Progress value={step === 1 ? 50 : 100} className="h-1.5" />
    </div>
  );
}

function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [step1Data, setStep1Data] = useState<Step1Values | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form1 = useForm<Step1Values>({
    resolver: zodResolver(step1Schema),
    mode: "onChange",
    defaultValues: { nombre: "", correo: "", password: "", confirm: "" },
  });

  const form2 = useForm<Step2Values>({
    resolver: zodResolver(step2Schema),
    mode: "onChange",
    defaultValues: {
      nombre_comercial: "",
      razon_social: "",
      documento_tributario: "",
      telefono_contacto: "",
      direccion: "",
    },
  });

  const onStep1 = (values: Step1Values) => {
    setStep1Data(values);
    setStep(2);
  };

  const onStep2 = async (values: Step2Values) => {
    if (!step1Data) {
      setStep(1);
      return;
    }
    setSubmitting(true);
    try {
      // 1) Crear usuario en auth
      const { data: signUp, error: signUpError } = await supabase.auth.signUp({
        email: step1Data.correo,
        password: step1Data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: { nombre: step1Data.nombre },
        },
      });

      if (signUpError) throw signUpError;
      const userId = signUp.user?.id;
      if (!userId) throw new Error("No se pudo crear el usuario.");

      // Asegurar sesión activa para que la RPC reciba auth.uid()
      if (!signUp.session) {
        const { error: signInError } =
          await supabase.auth.signInWithPassword({
            email: step1Data.correo,
            password: step1Data.password,
          });
        if (signInError) throw signInError;
      }

      // 2) Llamar RPC transaccional
      const { error: rpcError } = await supabase.rpc(
        "registrar_negocio_y_admin",
        {
          p_user_id: userId,
          p_nombre: step1Data.nombre,
          p_correo: step1Data.correo,
          p_nombre_comercial: values.nombre_comercial,
          p_razon_social: values.razon_social,
          p_documento_tributario: values.documento_tributario,
          p_telefono: values.telefono_contacto,
          p_direccion: values.direccion,
        },
      );

      if (rpcError) {
        // Cerrar sesión para no dejar un auth.user huérfano "activo"
        await supabase.auth.signOut();
        throw rpcError;
      }

      toast.success("¡Cuenta creada!", {
        description: "Bienvenido a Talia.",
      });
      navigate({ to: "/dashboard" });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "No se pudo completar el registro.";
      toast.error("Error en el registro", { description: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-md sm:max-w-lg">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Talia
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Crea tu cuenta y registra tu restaurante
          </p>
        </div>

        <Card>
          <CardHeader className="space-y-4">
            <Stepper step={step} />
            <div>
              <CardTitle className="text-lg sm:text-xl">
                {step === 1 ? "Datos de tu cuenta" : "Datos de tu negocio"}
              </CardTitle>
              <CardDescription>
                {step === 1
                  ? "Estos datos serán los de tu usuario administrador."
                  : "Información comercial del restaurante."}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            {step === 1 ? (
              <form
                onSubmit={form1.handleSubmit(onStep1)}
                className="space-y-4"
                noValidate
              >
                <Field
                  id="nombre"
                  label="Nombre completo"
                  autoComplete="name"
                  error={form1.formState.errors.nombre?.message}
                  {...form1.register("nombre")}
                />
                <Field
                  id="correo"
                  label="Correo electrónico"
                  type="email"
                  autoComplete="email"
                  error={form1.formState.errors.correo?.message}
                  {...form1.register("correo")}
                />
                <Field
                  id="password"
                  label="Contraseña"
                  type="password"
                  autoComplete="new-password"
                  error={form1.formState.errors.password?.message}
                  {...form1.register("password")}
                />
                <Field
                  id="confirm"
                  label="Confirmar contraseña"
                  type="password"
                  autoComplete="new-password"
                  error={form1.formState.errors.confirm?.message}
                  {...form1.register("confirm")}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={!form1.formState.isValid}
                >
                  Continuar
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>

                <p className="text-center text-xs text-muted-foreground">
                  ¿Ya tienes cuenta?{" "}
                  <Link to="/login" className="font-medium text-foreground hover:underline">
                    Inicia sesión
                  </Link>
                </p>
              </form>
            ) : (
              <form
                onSubmit={form2.handleSubmit(onStep2)}
                className="space-y-4"
                noValidate
              >
                <Field
                  id="nombre_comercial"
                  label="Nombre comercial"
                  error={form2.formState.errors.nombre_comercial?.message}
                  {...form2.register("nombre_comercial")}
                />
                <Field
                  id="razon_social"
                  label="Razón social"
                  error={form2.formState.errors.razon_social?.message}
                  {...form2.register("razon_social")}
                />
                <Field
                  id="documento_tributario"
                  label="Documento tributario (RUC / NIT / RFC)"
                  error={form2.formState.errors.documento_tributario?.message}
                  {...form2.register("documento_tributario")}
                />
                <Field
                  id="telefono_contacto"
                  label="Teléfono de contacto"
                  type="tel"
                  autoComplete="tel"
                  error={form2.formState.errors.telefono_contacto?.message}
                  {...form2.register("telefono_contacto")}
                />
                <Field
                  id="direccion"
                  label="Dirección"
                  error={form2.formState.errors.direccion?.message}
                  {...form2.register("direccion")}
                />

                <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    className="sm:flex-1"
                    onClick={() => setStep(1)}
                    disabled={submitting}
                  >
                    <ArrowLeft className="mr-1 h-4 w-4" />
                    Atrás
                  </Button>
                  <Button
                    type="submit"
                    className="sm:flex-1"
                    disabled={!form2.formState.isValid || submitting}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                        Creando...
                      </>
                    ) : (
                      <>
                        <Check className="mr-1 h-4 w-4" />
                        Crear cuenta
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  error?: string;
};

const Field = (function FieldFactory() {
  // forwardRef so react-hook-form's register() ref reaches the input
  return Object.assign(
    // eslint-disable-next-line react/display-name
    require("react").forwardRef<HTMLInputElement, FieldProps>(
      ({ id, label, error, ...props }: FieldProps, ref) => (
        <div className="space-y-1.5">
          <Label htmlFor={id}>{label}</Label>
          <Input id={id} ref={ref} aria-invalid={!!error} {...props} />
          {error ? (
            <p className="text-xs text-destructive">{error}</p>
          ) : null}
        </div>
      ),
    ),
  );
})() as unknown as React.ForwardRefExoticComponent<
  FieldProps & React.RefAttributes<HTMLInputElement>
>;
