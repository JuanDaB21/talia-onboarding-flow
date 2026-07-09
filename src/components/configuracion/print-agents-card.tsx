import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Monitor, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  crearPrintAgent,
  eliminarPrintAgent,
  listarPrintAgents,
  type PrintAgent,
} from "@/lib/impresion.functions";

/**
 * Gestión de print-agents (los PCs con impresoras que corren la app local). Crear
 * un agente devuelve un token que se pega en su config.json (se muestra una sola vez).
 */
export function PrintAgentsCard() {
  const [agents, setAgents] = useState<PrintAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [nombre, setNombre] = useState("");
  const [newToken, setNewToken] = useState<{ nombre: string; token: string } | null>(null);
  const [delTarget, setDelTarget] = useState<PrintAgent | null>(null);

  const load = async () => {
    try {
      setAgents(await listarPrintAgents());
    } catch {
      /* silencioso */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const id = setInterval(load, 15000); // refresca el estado de conexión
    return () => clearInterval(id);
  }, []);

  const handleCreate = async () => {
    if (nombre.trim().length < 1) return;
    try {
      const res = await crearPrintAgent(nombre.trim());
      setNewToken({ nombre: res.nombre, token: res.token });
      setNombre("");
      setCreating(false);
      await load();
    } catch (e) {
      toast.error("No se pudo crear el agente", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  };

  const handleDelete = async () => {
    if (!delTarget) return;
    try {
      await eliminarPrintAgent(delTarget.id_agente);
      toast.success("Agente eliminado");
      setDelTarget(null);
      await load();
    } catch (e) {
      toast.error("No se pudo eliminar", { description: e instanceof Error ? e.message : undefined });
    }
  };

  const copiar = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Token copiado");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  return (
    <Card className="p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Monitor className="h-4 w-4 text-muted-foreground" />
        <div className="flex-1">
          <p className="font-medium">Agentes de impresión</p>
          <p className="text-xs text-muted-foreground">
            PCs con impresoras que corren el print-agent local.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nuevo
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : agents.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aún no hay agentes. Crea uno e instálalo en el PC de las impresoras.
        </p>
      ) : (
        <ul className="space-y-1">
          {agents.map((a) => (
            <li key={a.id_agente} className="flex items-center gap-2 rounded-lg border p-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{a.nombre}</p>
                <p className="text-[11px] text-muted-foreground">
                  {a.last_seen_at
                    ? `Visto: ${new Date(a.last_seen_at).toLocaleString("es-CO")}`
                    : "Nunca conectado"}
                </p>
              </div>
              {a.conectado ? (
                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs">
                  Conectado
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs">
                  Desconectado
                </Badge>
              )}
              <Button
                size="icon"
                variant="ghost"
                className="text-destructive"
                onClick={() => setDelTarget(a)}
                aria-label="Eliminar agente"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <ResponsiveSheet open={creating} onOpenChange={setCreating} title="Nuevo agente de impresión">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="agente-nombre">Nombre</Label>
            <Input
              id="agente-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. PC Caja principal"
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={handleCreate}>
              Crear
            </Button>
          </div>
        </div>
      </ResponsiveSheet>

      {/* Token mostrado una sola vez */}
      <ResponsiveSheet
        open={!!newToken}
        onOpenChange={(o) => !o && setNewToken(null)}
        title="Token del agente"
      >
        {newToken && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Copia este token en el <span className="font-mono">config.json</span> del print-agent de{" "}
              <b>{newToken.nombre}</b>. No se volverá a mostrar.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded-lg bg-muted p-2 text-xs">{newToken.token}</code>
              <Button size="icon" variant="outline" onClick={() => copiar(newToken.token)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Button className="w-full" onClick={() => setNewToken(null)}>
              Listo
            </Button>
          </div>
        )}
      </ResponsiveSheet>

      <AlertDialog open={!!delTarget} onOpenChange={(o) => !o && setDelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar agente?</AlertDialogTitle>
            <AlertDialogDescription>
              El PC dejará de recibir comandas hasta que configures un token nuevo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
