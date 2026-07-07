import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { api, getTokens, onAuthExpired } from "@/lib/api-client";
import { useAuthUser } from "@/hooks/use-auth-user";
import { useChatStorage } from "@/hooks/use-chat-storage";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
  type ToolPart,
} from "@/components/ai-elements/tool";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import taliaAvatar from "@/assets/talia-avatar.png";

const SUGGESTIONS = [
  "¿Cómo van las ventas hoy?",
  "¿Qué insumos están bajos?",
  "¿Cuáles son los productos más vendidos esta semana?",
  "¿Qué mesas están ocupadas?",
];

export function ChatPanel() {
  const { user } = useAuthUser();
  const userId = user?.id ?? null;
  const { initial, ready, save, clear } = useChatStorage(userId);
  const [token, setToken] = useState<string | null>(() => getTokens()?.access ?? null);

  useEffect(() => {
    const update = () => setToken(getTokens()?.access ?? null);
    update();
    onAuthExpired.addEventListener("expired", update);
    return () => {
      onAuthExpired.removeEventListener("expired", update);
    };
  }, []);

  if (!ready || !userId || !token) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
        Cargando asistente…
      </div>
    );
  }


  return (
    <ChatInner
      key={userId}
      userId={userId}
      token={token}
      initial={initial}
      save={save}
      clear={clear}
    />
  );
}

function ChatInner({
  userId,
  token,
  initial,
  save,
  clear,
}: {
  userId: string;
  token: string | null;
  initial: UIMessage[];
  save: (m: UIMessage[]) => void;
  clear: () => void;
}) {
  const tokenRef = useRef<string | null>(token);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const transport = useRef(
    new DefaultChatTransport({
      api: `${api.url}/chat`,
      headers: (): Record<string, string> =>
        tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {},
    }),
  );


  const { messages, sendMessage, status, setMessages, stop } = useChat({
    id: userId,
    messages: initial,
    transport: transport.current,
    onError: (err) => {
      const msg = err.message || "";
      if (msg.includes("429")) {
        toast.error("Demasiadas solicitudes, intenta en un momento.");
      } else if (msg.includes("402")) {
        toast.error("Créditos de IA agotados. Contacta al administrador.");
      } else {
        toast.error("Error en el asistente: " + msg);
      }
    },
  });

  useEffect(() => {
    save(messages);
  }, [messages, save]);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    textareaRef.current?.focus();
  }, [status]);

  const isLoading = status === "submitted" || status === "streaming";

  const handleSubmit = (msg: PromptInputMessage) => {
    const text = msg.text?.trim();
    if (!text || isLoading) return;
    sendMessage({ text });
  };

  const handleClear = () => {
    setMessages([]);
    clear();
  };

  const sendSuggestion = (text: string) => {
    if (isLoading) return;
    sendMessage({ text });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3 pr-12">
        <div className="flex items-center gap-2">
          <img
            src={taliaAvatar}
            alt="Talia"
            width={28}
            height={28}
            loading="lazy"
            className="h-7 w-7 rounded-full bg-muted object-contain"
          />
          <div>
            <p className="text-sm font-semibold leading-tight">Talia</p>
            <p className="text-xs text-muted-foreground leading-tight">
              Asistente de tu restaurante
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={handleClear} title="Nueva conversación">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Conversation className="flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={
                <img
                  src={taliaAvatar}
                  alt=""
                  width={64}
                  height={64}
                  loading="lazy"
                  className="h-16 w-16 object-contain"
                />
              }
              title="¿En qué puedo ayudarte?"
              description="Pregúntame sobre ventas, inventario, mesas o pedidos."
            >
              <div className="mt-4 flex flex-col gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => sendSuggestion(s)}
                    className="rounded-lg border bg-card px-3 py-2 text-left text-sm transition hover:bg-accent"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </ConversationEmptyState>
          ) : (
            messages.map((m) => (
              <Message key={m.id} from={m.role === "user" ? "user" : "assistant"}>
                <MessageContent
                  className={
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-transparent p-0 text-foreground"
                  }
                >
                  {m.parts.map((part, i) => {
                    if (part.type === "text") {
                      return m.role === "assistant" ? (
                        <MessageResponse key={i}>{part.text}</MessageResponse>
                      ) : (
                        <span key={i} className="whitespace-pre-wrap">
                          {part.text}
                        </span>
                      );
                    }
                    if (
                      typeof part.type === "string" &&
                      (part.type.startsWith("tool-") || part.type === "dynamic-tool")
                    ) {
                      const tp = part as unknown as ToolPart;
                      const headerProps =
                        tp.type === "dynamic-tool"
                          ? { type: tp.type, state: tp.state, toolName: "tool" }
                          : { type: tp.type, state: tp.state };
                      return (
                        <Tool key={i} defaultOpen={false}>
                          <ToolHeader {...headerProps} />
                          <ToolContent>
                            <ToolInput input={tp.input} />
                            <ToolOutput
                              output={
                                tp.state === "output-available" ? tp.output : undefined
                              }
                              errorText={
                                tp.state === "output-error" ? tp.errorText : undefined
                              }
                            />
                          </ToolContent>
                        </Tool>
                      );
                    }
                    return null;
                  })}
                </MessageContent>
              </Message>
            ))
          )}
          {status === "submitted" && (
            <div className="px-2 py-1">
              <Shimmer>Pensando…</Shimmer>
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t p-3">
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputTextarea
            ref={textareaRef}
            placeholder="Pregunta sobre tu restaurante…"
            disabled={isLoading}
          />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} disabled={!token} onClick={isLoading ? stop : undefined} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
