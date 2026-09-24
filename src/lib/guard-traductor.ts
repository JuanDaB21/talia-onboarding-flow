// Red de seguridad React ↔ traductor del navegador (facebook/react#11538).
//
// Google Translate (y similares) reemplazan los nodos de texto por <font> y re-parentan
// hermanos. Cuando React luego quita o inserta junto a un nodo que el traductor movió, el DOM
// lanza "Failed to execute 'removeChild'/'insertBefore' on 'Node': ... is not a child of this
// node" y la pantalla se cae. Este parche solo cambia ese caso de error:
//   · removeChild de un nodo que ya no es hijo → no hace nada (ya no está ahí).
//   · insertBefore con una referencia que ya no es hija → inserta al final del padre, para que
//     el contenido nuevo (p. ej. el QR de transferencia) se vea aunque quede fuera de orden.
// En el camino normal (sin traductor) delega sin cambios al método original.
let instalado = false;

export function instalarGuardTraductor() {
  if (instalado || typeof Node === "undefined" || !Node.prototype) return;
  instalado = true;

  const removeChildOriginal = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) return child;
    return removeChildOriginal.call(this, child) as T;
  };

  const insertBeforeOriginal = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(
    this: Node,
    newNode: T,
    referenceNode: Node | null,
  ): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      return insertBeforeOriginal.call(this, newNode, null) as T;
    }
    return insertBeforeOriginal.call(this, newNode, referenceNode) as T;
  };
}
