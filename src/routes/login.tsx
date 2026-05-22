import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { forwardRef, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, LogIn } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Iniciar sesión — Talia" },
      {
        name: "description",
        content: "Accede a tu panel de Talia para gestionar tu restaurante.",
      },
    ],
  }),
  component: LoginPage,
});

const loginSchema = z.object({
  correo: z
    .string()
    .trim()
    .toLowerCase()
    .email("Correo no válido")
    .max(255),
  password: z.string().min(1, "Requerido").max(72),
});

type LoginValues = z.infer<typeof loginSchema>;

function LoginPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        navigate({ to: "/bodega" });
      }
    });
  }, [navigate]);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    mode: "onChange",
    defaultValues: { correo: "", password: "" },
  });

  const onSubmit = async (values: LoginValues) => {
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: values.correo,
        password: values.password,
      });

      if (error) {
        const msg =
          error.message === "Invalid login credentials"
            ? "Correo o contraseña incorrectos."
            : error.message;
        toast.error("No se pudo iniciar sesión", { description: msg });
        return;
      }

      toast.success("Bienvenido de vuelta");
      navigate({ to: "/bodega" });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Ocurrió un error inesperado.";
      toast.error("Error", { description: message });
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
            Accede a tu panel de administración
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Iniciar sesión</CardTitle>
            <CardDescription>
              Ingresa con el correo de tu cuenta de administrador.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4"
              noValidate
            >
              <Field
                id="correo"
                label="Correo electrónico"
                type="email"
                autoComplete="email"
                error={form.formState.errors.correo?.message}
                {...form.register("correo")}
              />
              <Field
                id="password"
                label="Contraseña"
                type="password"
                autoComplete="current-password"
                error={form.formState.errors.password?.message}
                {...form.register("password")}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={!form.formState.isValid || submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    Ingresando...
                  </>
                ) : (
                  <>
                    <LogIn className="mr-1 h-4 w-4" />
                    Iniciar sesión
                  </>
                )}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                ¿No tienes cuenta?{" "}
                <Link
                  to="/register"
                  className="font-medium text-foreground hover:underline"
                >
                  Crear cuenta
                </Link>
              </p>
            </form>
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

const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { id, label, error, ...props },
  ref,
) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} ref={ref} aria-invalid={!!error} {...props} />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
});
