import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { ChatPanel } from "./chat-panel";

export function FloatingChatButton() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          size="icon"
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg"
          aria-label="Abrir asistente Talia"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex w-full flex-col p-0 sm:max-w-md"
      >
        <ChatPanel />
      </SheetContent>
    </Sheet>
  );
}
