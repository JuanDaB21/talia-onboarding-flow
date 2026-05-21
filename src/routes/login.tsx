import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Iniciar sesión — Talia" }],
  }),
  component: LoginStub,
});

function LoginStub() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="max-w-sm text-center">
        <h1 className="text-2xl font-bold">Iniciar sesión</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Esta pantalla se implementará en la próxima iteración.
        </p>
        <Link
          to="/register"
          className="mt-4 inline-block text-sm font-medium text-foreground underline"
        >
          Crear una cuenta
        </Link>
      </div>
    </main>
  );
}
