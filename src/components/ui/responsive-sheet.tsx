import { ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface ResponsiveSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** Tailwind classes para el ancho en desktop. Default: `sm:max-w-md`. */
  desktopWidthClass?: string;
}

/**
 * Sheet contenedor reutilizable.
 * Mobile (< 768px): aparece desde abajo.
 * Desktop (>= 768px): aparece desde la derecha.
 */
export function ResponsiveSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  desktopWidthClass = "sm:max-w-md",
}: ResponsiveSheetProps) {
  const isMobile = useIsMobile();
  const side = isMobile ? "bottom" : "right";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        className={
          isMobile
            ? "max-h-[90vh] overflow-y-auto rounded-t-2xl"
            : `w-full ${desktopWidthClass} overflow-y-auto overflow-x-hidden`
        }
      >
        <SheetHeader className="text-left">
          <SheetTitle>{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </SheetHeader>
        <div className="mt-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

