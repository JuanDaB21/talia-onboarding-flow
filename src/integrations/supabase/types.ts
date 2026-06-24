export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bono_aplicaciones: {
        Row: {
          created_at: string
          id_aplicacion: string
          id_bono: string | null
          id_mesa: string | null
          id_mesero: string | null
          id_negocio: string
          id_pago: string
          monto_descuento: number
          monto_descuento_neto: number
          nombre_bono: string
          porcentaje_aplicado: number
          subtotal_items: number
        }
        Insert: {
          created_at?: string
          id_aplicacion?: string
          id_bono?: string | null
          id_mesa?: string | null
          id_mesero?: string | null
          id_negocio: string
          id_pago: string
          monto_descuento: number
          monto_descuento_neto: number
          nombre_bono: string
          porcentaje_aplicado: number
          subtotal_items: number
        }
        Update: {
          created_at?: string
          id_aplicacion?: string
          id_bono?: string | null
          id_mesa?: string | null
          id_mesero?: string | null
          id_negocio?: string
          id_pago?: string
          monto_descuento?: number
          monto_descuento_neto?: number
          nombre_bono?: string
          porcentaje_aplicado?: number
          subtotal_items?: number
        }
        Relationships: [
          {
            foreignKeyName: "bono_aplicaciones_id_bono_fkey"
            columns: ["id_bono"]
            isOneToOne: false
            referencedRelation: "bonos"
            referencedColumns: ["id_bono"]
          },
          {
            foreignKeyName: "bono_aplicaciones_id_mesa_fkey"
            columns: ["id_mesa"]
            isOneToOne: false
            referencedRelation: "mesas"
            referencedColumns: ["id_mesa"]
          },
          {
            foreignKeyName: "bono_aplicaciones_id_negocio_fkey"
            columns: ["id_negocio"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id_negocio"]
          },
          {
            foreignKeyName: "bono_aplicaciones_id_pago_fkey"
            columns: ["id_pago"]
            isOneToOne: false
            referencedRelation: "pagos"
            referencedColumns: ["id_pago"]
          },
        ]
      }
      bonos: {
        Row: {
          activo: boolean
          created_at: string
          id_bono: string
          id_negocio: string
          nombre: string
          porcentaje: number
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          id_bono?: string
          id_negocio: string
          nombre: string
          porcentaje: number
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          id_bono?: string
          id_negocio?: string
          nombre?: string
          porcentaje?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bonos_id_negocio_fkey"
            columns: ["id_negocio"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id_negocio"]
          },
        ]
      }
      caja_dia: {
        Row: {
          abierta_at: string
          abierta_por: string
          base_inicial: number
          cerrada_at: string | null
          cerrada_por: string | null
          created_at: string
          datafono_fisico: number
          datafono_sistema: number
          diferencia_datafono: number
          diferencia_efectivo: number
          efectivo_fisico: number
          efectivo_sistema: number
          estado: string
          fecha: string
          id_caja: string
          id_negocio: string
          nota_cuadre: string | null
          transferencia_sistema: number
        }
        Insert: {
          abierta_at?: string
          abierta_por: string
          base_inicial?: number
          cerrada_at?: string | null
          cerrada_por?: string | null
          created_at?: string
          datafono_fisico?: number
          datafono_sistema?: number
          diferencia_datafono?: number
          diferencia_efectivo?: number
          efectivo_fisico?: number
          efectivo_sistema?: number
          estado?: string
          fecha?: string
          id_caja?: string
          id_negocio: string
          nota_cuadre?: string | null
          transferencia_sistema?: number
        }
        Update: {
          abierta_at?: string
          abierta_por?: string
          base_inicial?: number
          cerrada_at?: string | null
          cerrada_por?: string | null
          created_at?: string
          datafono_fisico?: number
          datafono_sistema?: number
          diferencia_datafono?: number
          diferencia_efectivo?: number
          efectivo_fisico?: number
          efectivo_sistema?: number
          estado?: string
          fecha?: string
          id_caja?: string
          id_negocio?: string
          nota_cuadre?: string | null
          transferencia_sistema?: number
        }
        Relationships: []
      }
      categorias: {
        Row: {
          created_at: string
          destino: string
          id_categoria: string
          id_negocio: string
          nombre: string
          orden: number
        }
        Insert: {
          created_at?: string
          destino?: string
          id_categoria?: string
          id_negocio: string
          nombre: string
          orden?: number
        }
        Update: {
          created_at?: string
          destino?: string
          id_categoria?: string
          id_negocio?: string
          nombre?: string
          orden?: number
        }
        Relationships: [
          {
            foreignKeyName: "categorias_id_negocio_fkey"
            columns: ["id_negocio"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id_negocio"]
          },
        ]
      }
      compras: {
        Row: {
          created_at: string
          estado: string
          fecha_compra: string
          id_compra: string
          id_negocio: string
          id_proveedor: string
          numero_factura: string | null
          observaciones: string | null
          total: number
        }
        Insert: {
          created_at?: string
          estado?: string
          fecha_compra?: string
          id_compra?: string
          id_negocio: string
          id_proveedor: string
          numero_factura?: string | null
          observaciones?: string | null
          total?: number
        }
        Update: {
          created_at?: string
          estado?: string
          fecha_compra?: string
          id_compra?: string
          id_negocio?: string
          id_proveedor?: string
          numero_factura?: string | null
          observaciones?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "compras_id_negocio_fkey"
            columns: ["id_negocio"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id_negocio"]
          },
          {
            foreignKeyName: "compras_id_proveedor_fkey"
            columns: ["id_proveedor"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id_proveedor"]
          },
        ]
      }
      detalle_compra: {
        Row: {
          cantidad: number
          created_at: string
          id_compra: string
          id_detalle: string
          id_insumo: string
          precio_unitario_compra: number
          subtotal: number
        }
        Insert: {
          cantidad: number
          created_at?: string
          id_compra: string
          id_detalle?: string
          id_insumo: string
          precio_unitario_compra: number
          subtotal?: number
        }
        Update: {
          cantidad?: number
          created_at?: string
          id_compra?: string
          id_detalle?: string
          id_insumo?: string
          precio_unitario_compra?: number
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "detalle_compra_id_compra_fkey"
            columns: ["id_compra"]
            isOneToOne: false
            referencedRelation: "compras"
            referencedColumns: ["id_compra"]
          },
          {
            foreignKeyName: "detalle_compra_id_insumo_fkey"
            columns: ["id_insumo"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id_insumo"]
          },
        ]
      }
      extras_permitidos: {
        Row: {
          cantidad_porcion: number
          created_at: string
          id_extra: string
          id_insumo_extra: string
          id_producto: string
          precio_extra: number
        }
        Insert: {
          cantidad_porcion: number
          created_at?: string
          id_extra?: string
          id_insumo_extra: string
          id_producto: string
          precio_extra?: number
        }
        Update: {
          cantidad_porcion?: number
          created_at?: string
          id_extra?: string
          id_insumo_extra?: string
          id_producto?: string
          precio_extra?: number
        }
        Relationships: [
          {
            foreignKeyName: "extras_permitidos_id_insumo_extra_fkey"
            columns: ["id_insumo_extra"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id_insumo"]
          },
          {
            foreignKeyName: "extras_permitidos_id_producto_fkey"
            columns: ["id_producto"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id_producto"]
          },
        ]
      }
      insumos: {
        Row: {
          costo_promedio: number
          created_at: string
          factor_conversion: number
          id_insumo: string
          id_negocio: string
          nombre_insumo: string
          stock_minimo: number
          unidad_compra: string
          unidad_receta: string
        }
        Insert: {
          costo_promedio?: number
          created_at?: string
          factor_conversion?: number
          id_insumo?: string
          id_negocio: string
          nombre_insumo: string
          stock_minimo?: number
          unidad_compra: string
          unidad_receta: string
        }
        Update: {
          costo_promedio?: number
          created_at?: string
          factor_conversion?: number
          id_insumo?: string
          id_negocio?: string
          nombre_insumo?: string
          stock_minimo?: number
          unidad_compra?: string
          unidad_receta?: string
        }
        Relationships: [
          {
            foreignKeyName: "insumos_id_negocio_fkey"
            columns: ["id_negocio"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id_negocio"]
          },
        ]
      }
      inventario_actual: {
        Row: {
          cantidad_actual: number
          created_at: string
          id_insumo: string
          id_inventario: string
          id_negocio: string
          updated_at: string
        }
        Insert: {
          cantidad_actual?: number
          created_at?: string
          id_insumo: string
          id_inventario?: string
          id_negocio: string
          updated_at?: string
        }
        Update: {
          cantidad_actual?: number
          created_at?: string
          id_insumo?: string
          id_inventario?: string
          id_negocio?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventario_actual_id_insumo_fkey"
            columns: ["id_insumo"]
            isOneToOne: true
            referencedRelation: "insumos"
            referencedColumns: ["id_insumo"]
          },
          {
            foreignKeyName: "inventario_actual_id_negocio_fkey"
            columns: ["id_negocio"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id_negocio"]
          },
        ]
      }
      mesas: {
        Row: {
          asignada_at: string | null
          created_at: string
          estado: string
          id_mesa: string
          id_mesero_asignado: string | null
          id_negocio: string
          identificador: string
          liberada_at: string | null
          solicitud_at: string | null
          solicitud_cliente: string | null
          updated_at: string
        }
        Insert: {
          asignada_at?: string | null
          created_at?: string
          estado?: string
          id_mesa?: string
          id_mesero_asignado?: string | null
          id_negocio: string
          identificador: string
          liberada_at?: string | null
          solicitud_at?: string | null
          solicitud_cliente?: string | null
          updated_at?: string
        }
        Update: {
          asignada_at?: string | null
          created_at?: string
          estado?: string
          id_mesa?: string
          id_mesero_asignado?: string | null
          id_negocio?: string
          identificador?: string
          liberada_at?: string | null
          solicitud_at?: string | null
          solicitud_cliente?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mesas_id_mesero_asignado_fkey"
            columns: ["id_mesero_asignado"]
            isOneToOne: false
            referencedRelation: "usuarios_staff"
            referencedColumns: ["id_usuario"]
          },
          {
            foreignKeyName: "mesas_id_negocio_fkey"
            columns: ["id_negocio"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id_negocio"]
          },
        ]
      }
      metodos_pago_qr: {
        Row: {
          created_at: string
          etiqueta: string | null
          id_negocio: string
          id_qr: string
          plataforma: string
          titular: string | null
          updated_at: string
          url_qr: string
        }
        Insert: {
          created_at?: string
          etiqueta?: string | null
          id_negocio: string
          id_qr?: string
          plataforma: string
          titular?: string | null
          updated_at?: string
          url_qr: string
        }
        Update: {
          created_at?: string
          etiqueta?: string | null
          id_negocio?: string
          id_qr?: string
          plataforma?: string
          titular?: string | null
          updated_at?: string
          url_qr?: string
        }
        Relationships: [
          {
            foreignKeyName: "metodos_pago_qr_id_negocio_fkey"
            columns: ["id_negocio"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id_negocio"]
          },
        ]
      }
      movimientos_inventario: {
        Row: {
          cantidad: number
          cantidad_anterior: number
          cantidad_nueva: number
          created_at: string
          id_insumo: string
          id_movimiento: string
          id_negocio: string
          id_usuario: string | null
          motivo: string | null
          referencia_id: string | null
          tipo_movimiento: string
        }
        Insert: {
          cantidad: number
          cantidad_anterior: number
          cantidad_nueva: number
          created_at?: string
          id_insumo: string
          id_movimiento?: string
          id_negocio: string
          id_usuario?: string | null
          motivo?: string | null
          referencia_id?: string | null
          tipo_movimiento: string
        }
        Update: {
          cantidad?: number
          cantidad_anterior?: number
          cantidad_nueva?: number
          created_at?: string
          id_insumo?: string
          id_movimiento?: string
          id_negocio?: string
          id_usuario?: string | null
          motivo?: string | null
          referencia_id?: string | null
          tipo_movimiento?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_inventario_id_insumo_fkey"
            columns: ["id_insumo"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id_insumo"]
          },
          {
            foreignKeyName: "movimientos_inventario_id_negocio_fkey"
            columns: ["id_negocio"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id_negocio"]
          },
          {
            foreignKeyName: "movimientos_inventario_id_usuario_fkey"
            columns: ["id_usuario"]
            isOneToOne: false
            referencedRelation: "usuarios_staff"
            referencedColumns: ["id_usuario"]
          },
        ]
      }
      negocio: {
        Row: {
          created_at: string
          direccion: string
          documento_tributario: string
          estado: boolean
          id_negocio: string
          nombre_comercial: string
          porcentaje_retencion_propina: number
          razon_social: string
          telefono_contacto: string
          tema_menu: string
          timezone: string
          url_logo: string | null
        }
        Insert: {
          created_at?: string
          direccion: string
          documento_tributario: string
          estado?: boolean
          id_negocio?: string
          nombre_comercial: string
          porcentaje_retencion_propina?: number
          razon_social: string
          telefono_contacto: string
          tema_menu?: string
          timezone?: string
          url_logo?: string | null
        }
        Update: {
          created_at?: string
          direccion?: string
          documento_tributario?: string
          estado?: boolean
          id_negocio?: string
          nombre_comercial?: string
          porcentaje_retencion_propina?: number
          razon_social?: string
          telefono_contacto?: string
          tema_menu?: string
          timezone?: string
          url_logo?: string | null
        }
        Relationships: []
      }
      pago_items: {
        Row: {
          created_at: string
          id_item: string
          id_pago: string
          id_pi: string
          monto: number
        }
        Insert: {
          created_at?: string
          id_item: string
          id_pago: string
          id_pi?: string
          monto?: number
        }
        Update: {
          created_at?: string
          id_item?: string
          id_pago?: string
          id_pi?: string
          monto?: number
        }
        Relationships: [
          {
            foreignKeyName: "pago_items_id_pago_fkey"
            columns: ["id_pago"]
            isOneToOne: false
            referencedRelation: "pagos"
            referencedColumns: ["id_pago"]
          },
        ]
      }
      pagos: {
        Row: {
          confirmado_at: string | null
          confirmado_por: string | null
          created_at: string
          descuento_bono: number
          descuento_neto: number
          estado_confirmacion: Database["public"]["Enums"]["estado_pago"]
          id_bono: string | null
          id_mesa: string
          id_mesero: string | null
          id_negocio: string
          id_pago: string
          metodo: Database["public"]["Enums"]["metodo_pago"]
          monto: number
          propina: number
          subtipo: string | null
          url_comprobante: string | null
          voucher: string | null
        }
        Insert: {
          confirmado_at?: string | null
          confirmado_por?: string | null
          created_at?: string
          descuento_bono?: number
          descuento_neto?: number
          estado_confirmacion?: Database["public"]["Enums"]["estado_pago"]
          id_bono?: string | null
          id_mesa: string
          id_mesero?: string | null
          id_negocio: string
          id_pago?: string
          metodo: Database["public"]["Enums"]["metodo_pago"]
          monto: number
          propina?: number
          subtipo?: string | null
          url_comprobante?: string | null
          voucher?: string | null
        }
        Update: {
          confirmado_at?: string | null
          confirmado_por?: string | null
          created_at?: string
          descuento_bono?: number
          descuento_neto?: number
          estado_confirmacion?: Database["public"]["Enums"]["estado_pago"]
          id_bono?: string | null
          id_mesa?: string
          id_mesero?: string | null
          id_negocio?: string
          id_pago?: string
          metodo?: Database["public"]["Enums"]["metodo_pago"]
          monto?: number
          propina?: number
          subtipo?: string | null
          url_comprobante?: string | null
          voucher?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pagos_id_bono_fkey"
            columns: ["id_bono"]
            isOneToOne: false
            referencedRelation: "bonos"
            referencedColumns: ["id_bono"]
          },
        ]
      }
      pedido_item_exclusiones: {
        Row: {
          id_insumo: string
          id_item: string
          id_pix: string
        }
        Insert: {
          id_insumo: string
          id_item: string
          id_pix?: string
        }
        Update: {
          id_insumo?: string
          id_item?: string
          id_pix?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedido_item_exclusiones_id_insumo_fkey"
            columns: ["id_insumo"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id_insumo"]
          },
          {
            foreignKeyName: "pedido_item_exclusiones_id_item_fkey"
            columns: ["id_item"]
            isOneToOne: false
            referencedRelation: "pedido_items"
            referencedColumns: ["id_item"]
          },
        ]
      }
      pedido_item_extras: {
        Row: {
          cantidad_porcion: number
          id_insumo_extra: string
          id_item: string
          id_pie: string
          precio_extra: number
        }
        Insert: {
          cantidad_porcion: number
          id_insumo_extra: string
          id_item: string
          id_pie?: string
          precio_extra?: number
        }
        Update: {
          cantidad_porcion?: number
          id_insumo_extra?: string
          id_item?: string
          id_pie?: string
          precio_extra?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedido_item_extras_id_insumo_extra_fkey"
            columns: ["id_insumo_extra"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id_insumo"]
          },
          {
            foreignKeyName: "pedido_item_extras_id_item_fkey"
            columns: ["id_item"]
            isOneToOne: false
            referencedRelation: "pedido_items"
            referencedColumns: ["id_item"]
          },
        ]
      }
      pedido_item_variantes: {
        Row: {
          id_grupo: string | null
          id_item: string
          id_opcion: string | null
          id_piv: string
          id_producto_opcion: string | null
          nombre_grupo: string
          nombre_opcion: string
          precio_delta: number
        }
        Insert: {
          id_grupo?: string | null
          id_item: string
          id_opcion?: string | null
          id_piv?: string
          id_producto_opcion?: string | null
          nombre_grupo: string
          nombre_opcion: string
          precio_delta?: number
        }
        Update: {
          id_grupo?: string | null
          id_item?: string
          id_opcion?: string | null
          id_piv?: string
          id_producto_opcion?: string | null
          nombre_grupo?: string
          nombre_opcion?: string
          precio_delta?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedido_item_variantes_id_grupo_fkey"
            columns: ["id_grupo"]
            isOneToOne: false
            referencedRelation: "producto_variante_grupos"
            referencedColumns: ["id_grupo"]
          },
          {
            foreignKeyName: "pedido_item_variantes_id_item_fkey"
            columns: ["id_item"]
            isOneToOne: false
            referencedRelation: "pedido_items"
            referencedColumns: ["id_item"]
          },
          {
            foreignKeyName: "pedido_item_variantes_id_opcion_fkey"
            columns: ["id_opcion"]
            isOneToOne: false
            referencedRelation: "producto_variante_opciones"
            referencedColumns: ["id_opcion"]
          },
          {
            foreignKeyName: "pedido_item_variantes_id_producto_opcion_fkey"
            columns: ["id_producto_opcion"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id_producto"]
          },
        ]
      }
      pedido_items: {
        Row: {
          cantidad: number
          created_at: string
          destino: string | null
          entregado_at: string | null
          estado_preparacion: string
          id_item: string
          id_pago: string | null
          id_pedido: string
          id_producto: string
          iniciado_at: string | null
          listo_at: string | null
          nota: string | null
          pagado_at: string | null
          precio_unitario: number
          tiempo_planeado_min: number | null
          tiene_alergia: boolean
        }
        Insert: {
          cantidad: number
          created_at?: string
          destino?: string | null
          entregado_at?: string | null
          estado_preparacion?: string
          id_item?: string
          id_pago?: string | null
          id_pedido: string
          id_producto: string
          iniciado_at?: string | null
          listo_at?: string | null
          nota?: string | null
          pagado_at?: string | null
          precio_unitario?: number
          tiempo_planeado_min?: number | null
          tiene_alergia?: boolean
        }
        Update: {
          cantidad?: number
          created_at?: string
          destino?: string | null
          entregado_at?: string | null
          estado_preparacion?: string
          id_item?: string
          id_pago?: string | null
          id_pedido?: string
          id_producto?: string
          iniciado_at?: string | null
          listo_at?: string | null
          nota?: string | null
          pagado_at?: string | null
          precio_unitario?: number
          tiempo_planeado_min?: number | null
          tiene_alergia?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "pedido_items_id_pedido_fkey"
            columns: ["id_pedido"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id_pedido"]
          },
          {
            foreignKeyName: "pedido_items_id_producto_fkey"
            columns: ["id_producto"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id_producto"]
          },
        ]
      }
      pedidos: {
        Row: {
          confirmado_at: string | null
          created_at: string
          entregado_at: string | null
          estado: Database["public"]["Enums"]["estado_pedido"]
          id_mesa: string
          id_mesero: string | null
          id_negocio: string
          id_pedido: string
          pagado_at: string | null
          seguimiento_visto_at: string | null
          total: number
          updated_at: string
        }
        Insert: {
          confirmado_at?: string | null
          created_at?: string
          entregado_at?: string | null
          estado?: Database["public"]["Enums"]["estado_pedido"]
          id_mesa: string
          id_mesero?: string | null
          id_negocio: string
          id_pedido?: string
          pagado_at?: string | null
          seguimiento_visto_at?: string | null
          total?: number
          updated_at?: string
        }
        Update: {
          confirmado_at?: string | null
          created_at?: string
          entregado_at?: string | null
          estado?: Database["public"]["Enums"]["estado_pedido"]
          id_mesa?: string
          id_mesero?: string | null
          id_negocio?: string
          id_pedido?: string
          pagado_at?: string | null
          seguimiento_visto_at?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_id_mesa_fkey"
            columns: ["id_mesa"]
            isOneToOne: false
            referencedRelation: "mesas"
            referencedColumns: ["id_mesa"]
          },
          {
            foreignKeyName: "pedidos_id_mesero_fkey"
            columns: ["id_mesero"]
            isOneToOne: false
            referencedRelation: "usuarios_staff"
            referencedColumns: ["id_usuario"]
          },
          {
            foreignKeyName: "pedidos_id_negocio_fkey"
            columns: ["id_negocio"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id_negocio"]
          },
        ]
      }
      prepedido_items: {
        Row: {
          cantidad: number
          created_at: string
          exclusiones: Json
          extras: Json
          id_mesa: string
          id_prepedido_item: string
          id_producto: string
          id_sesion: string
          nota: string | null
          precio_unitario: number
          tiene_alergia: boolean
          updated_at: string
          variantes: Json
        }
        Insert: {
          cantidad: number
          created_at?: string
          exclusiones?: Json
          extras?: Json
          id_mesa: string
          id_prepedido_item?: string
          id_producto: string
          id_sesion: string
          nota?: string | null
          precio_unitario: number
          tiene_alergia?: boolean
          updated_at?: string
          variantes?: Json
        }
        Update: {
          cantidad?: number
          created_at?: string
          exclusiones?: Json
          extras?: Json
          id_mesa?: string
          id_prepedido_item?: string
          id_producto?: string
          id_sesion?: string
          nota?: string | null
          precio_unitario?: number
          tiene_alergia?: boolean
          updated_at?: string
          variantes?: Json
        }
        Relationships: [
          {
            foreignKeyName: "prepedido_items_id_mesa_fkey"
            columns: ["id_mesa"]
            isOneToOne: false
            referencedRelation: "mesas"
            referencedColumns: ["id_mesa"]
          },
          {
            foreignKeyName: "prepedido_items_id_producto_fkey"
            columns: ["id_producto"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id_producto"]
          },
          {
            foreignKeyName: "prepedido_items_id_sesion_fkey"
            columns: ["id_sesion"]
            isOneToOne: false
            referencedRelation: "prepedido_sesiones"
            referencedColumns: ["id_sesion"]
          },
        ]
      }
      prepedido_sesiones: {
        Row: {
          created_at: string
          id_cliente: string
          id_mesa: string
          id_sesion: string
          last_seen_at: string
          nombre: string
        }
        Insert: {
          created_at?: string
          id_cliente: string
          id_mesa: string
          id_sesion?: string
          last_seen_at?: string
          nombre: string
        }
        Update: {
          created_at?: string
          id_cliente?: string
          id_mesa?: string
          id_sesion?: string
          last_seen_at?: string
          nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "prepedido_sesiones_id_mesa_fkey"
            columns: ["id_mesa"]
            isOneToOne: false
            referencedRelation: "mesas"
            referencedColumns: ["id_mesa"]
          },
        ]
      }
      producto_variante_grupos: {
        Row: {
          created_at: string
          id_grupo: string
          id_producto: string
          nombre: string
          orden: number
          seleccion: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id_grupo?: string
          id_producto: string
          nombre: string
          orden?: number
          seleccion: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id_grupo?: string
          id_producto?: string
          nombre?: string
          orden?: number
          seleccion?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "producto_variante_grupos_id_producto_fkey"
            columns: ["id_producto"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id_producto"]
          },
        ]
      }
      producto_variante_opciones: {
        Row: {
          created_at: string
          id_grupo: string
          id_opcion: string
          id_producto_opcion: string
          orden: number
          precio_delta: number
        }
        Insert: {
          created_at?: string
          id_grupo: string
          id_opcion?: string
          id_producto_opcion: string
          orden?: number
          precio_delta?: number
        }
        Update: {
          created_at?: string
          id_grupo?: string
          id_opcion?: string
          id_producto_opcion?: string
          orden?: number
          precio_delta?: number
        }
        Relationships: [
          {
            foreignKeyName: "producto_variante_opciones_id_grupo_fkey"
            columns: ["id_grupo"]
            isOneToOne: false
            referencedRelation: "producto_variante_grupos"
            referencedColumns: ["id_grupo"]
          },
          {
            foreignKeyName: "producto_variante_opciones_id_producto_opcion_fkey"
            columns: ["id_producto_opcion"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id_producto"]
          },
        ]
      }
      productos: {
        Row: {
          activo: boolean
          created_at: string
          descripcion_producto: string | null
          id_negocio: string
          id_producto: string
          id_receta: string
          nombre_producto: string
          precio_venta: number
          updated_at: string
          url_imagen: string | null
        }
        Insert: {
          activo?: boolean
          created_at?: string
          descripcion_producto?: string | null
          id_negocio: string
          id_producto?: string
          id_receta: string
          nombre_producto: string
          precio_venta?: number
          updated_at?: string
          url_imagen?: string | null
        }
        Update: {
          activo?: boolean
          created_at?: string
          descripcion_producto?: string | null
          id_negocio?: string
          id_producto?: string
          id_receta?: string
          nombre_producto?: string
          precio_venta?: number
          updated_at?: string
          url_imagen?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "productos_id_negocio_fkey"
            columns: ["id_negocio"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id_negocio"]
          },
          {
            foreignKeyName: "productos_id_receta_fkey"
            columns: ["id_receta"]
            isOneToOne: true
            referencedRelation: "receta_master"
            referencedColumns: ["id_receta"]
          },
        ]
      }
      proveedores: {
        Row: {
          created_at: string
          documento_tributario: string
          estado: boolean
          id_negocio: string
          id_proveedor: string
          nombre_contacto: string
          razon_social: string
          telefono: string
        }
        Insert: {
          created_at?: string
          documento_tributario: string
          estado?: boolean
          id_negocio: string
          id_proveedor?: string
          nombre_contacto: string
          razon_social: string
          telefono: string
        }
        Update: {
          created_at?: string
          documento_tributario?: string
          estado?: boolean
          id_negocio?: string
          id_proveedor?: string
          nombre_contacto?: string
          razon_social?: string
          telefono?: string
        }
        Relationships: [
          {
            foreignKeyName: "proveedores_id_negocio_fkey"
            columns: ["id_negocio"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id_negocio"]
          },
        ]
      }
      receta_detalle: {
        Row: {
          cantidad: number
          created_at: string
          id_detalle: string
          id_insumo: string
          id_receta: string
        }
        Insert: {
          cantidad: number
          created_at?: string
          id_detalle?: string
          id_insumo: string
          id_receta: string
        }
        Update: {
          cantidad?: number
          created_at?: string
          id_detalle?: string
          id_insumo?: string
          id_receta?: string
        }
        Relationships: [
          {
            foreignKeyName: "receta_detalle_id_insumo_fkey"
            columns: ["id_insumo"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id_insumo"]
          },
          {
            foreignKeyName: "receta_detalle_id_receta_fkey"
            columns: ["id_receta"]
            isOneToOne: false
            referencedRelation: "receta_master"
            referencedColumns: ["id_receta"]
          },
        ]
      }
      receta_master: {
        Row: {
          created_at: string
          descripcion: string | null
          id_categoria: string
          id_negocio: string
          id_receta: string
          id_subcategoria: string
          nombre_receta: string
          tiempo_preparacion_min: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          descripcion?: string | null
          id_categoria: string
          id_negocio: string
          id_receta?: string
          id_subcategoria: string
          nombre_receta: string
          tiempo_preparacion_min?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          descripcion?: string | null
          id_categoria?: string
          id_negocio?: string
          id_receta?: string
          id_subcategoria?: string
          nombre_receta?: string
          tiempo_preparacion_min?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receta_master_id_categoria_fkey"
            columns: ["id_categoria"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id_categoria"]
          },
          {
            foreignKeyName: "receta_master_id_negocio_fkey"
            columns: ["id_negocio"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id_negocio"]
          },
          {
            foreignKeyName: "receta_master_id_subcategoria_fkey"
            columns: ["id_subcategoria"]
            isOneToOne: false
            referencedRelation: "subcategorias"
            referencedColumns: ["id_subcategoria"]
          },
        ]
      }
      reservas: {
        Row: {
          cantidad_personas: number
          codigo_reserva: string
          created_at: string
          created_by: string | null
          customer_name: string
          customer_phone: string | null
          estado: string
          fecha_reserva: string
          hora_reserva: string
          id_negocio: string
          id_pedido_aplicado: string | null
          id_reserva: string
          monto_abonado: number
          tipo_reserva: string | null
          updated_at: string
        }
        Insert: {
          cantidad_personas: number
          codigo_reserva: string
          created_at?: string
          created_by?: string | null
          customer_name: string
          customer_phone?: string | null
          estado?: string
          fecha_reserva: string
          hora_reserva: string
          id_negocio: string
          id_pedido_aplicado?: string | null
          id_reserva?: string
          monto_abonado?: number
          tipo_reserva?: string | null
          updated_at?: string
        }
        Update: {
          cantidad_personas?: number
          codigo_reserva?: string
          created_at?: string
          created_by?: string | null
          customer_name?: string
          customer_phone?: string | null
          estado?: string
          fecha_reserva?: string
          hora_reserva?: string
          id_negocio?: string
          id_pedido_aplicado?: string | null
          id_reserva?: string
          monto_abonado?: number
          tipo_reserva?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservas_id_negocio_fkey"
            columns: ["id_negocio"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id_negocio"]
          },
          {
            foreignKeyName: "reservas_id_pedido_aplicado_fkey"
            columns: ["id_pedido_aplicado"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id_pedido"]
          },
        ]
      }
      subcategorias: {
        Row: {
          created_at: string
          id_categoria: string
          id_negocio: string
          id_subcategoria: string
          nombre: string
          orden: number
        }
        Insert: {
          created_at?: string
          id_categoria: string
          id_negocio: string
          id_subcategoria?: string
          nombre: string
          orden?: number
        }
        Update: {
          created_at?: string
          id_categoria?: string
          id_negocio?: string
          id_subcategoria?: string
          nombre?: string
          orden?: number
        }
        Relationships: [
          {
            foreignKeyName: "subcategorias_id_categoria_fkey"
            columns: ["id_categoria"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id_categoria"]
          },
          {
            foreignKeyName: "subcategorias_id_negocio_fkey"
            columns: ["id_negocio"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id_negocio"]
          },
        ]
      }
      turnos_staff: {
        Row: {
          cerrado_por: string | null
          created_at: string
          finalizado_at: string | null
          id_negocio: string
          id_turno: string
          id_usuario: string
          iniciado_at: string
        }
        Insert: {
          cerrado_por?: string | null
          created_at?: string
          finalizado_at?: string | null
          id_negocio: string
          id_turno?: string
          id_usuario: string
          iniciado_at?: string
        }
        Update: {
          cerrado_por?: string | null
          created_at?: string
          finalizado_at?: string | null
          id_negocio?: string
          id_turno?: string
          id_usuario?: string
          iniciado_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "turnos_staff_id_negocio_fkey"
            columns: ["id_negocio"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id_negocio"]
          },
        ]
      }
      usuarios_staff: {
        Row: {
          correo: string
          created_at: string
          esta_en_turno: boolean
          estado: Database["public"]["Enums"]["estado_staff"]
          id_negocio: string
          id_usuario: string
          nombre: string
          recibe_propinas: boolean
          rol: Database["public"]["Enums"]["rol_staff"]
          turno_iniciado_at: string | null
        }
        Insert: {
          correo: string
          created_at?: string
          esta_en_turno?: boolean
          estado?: Database["public"]["Enums"]["estado_staff"]
          id_negocio: string
          id_usuario: string
          nombre: string
          recibe_propinas?: boolean
          rol: Database["public"]["Enums"]["rol_staff"]
          turno_iniciado_at?: string | null
        }
        Update: {
          correo?: string
          created_at?: string
          esta_en_turno?: boolean
          estado?: Database["public"]["Enums"]["estado_staff"]
          id_negocio?: string
          id_usuario?: string
          nombre?: string
          recibe_propinas?: boolean
          rol?: Database["public"]["Enums"]["rol_staff"]
          turno_iniciado_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_staff_id_negocio_fkey"
            columns: ["id_negocio"]
            isOneToOne: false
            referencedRelation: "negocio"
            referencedColumns: ["id_negocio"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      abrir_caja: { Args: { p_base: number }; Returns: string }
      aceptar_prepedido_mesa: { Args: { p_id_mesa: string }; Returns: number }
      actualizar_receta:
        | {
            Args: {
              p_descripcion: string
              p_id_categoria: string
              p_id_receta: string
              p_id_subcategoria: string
              p_ingredientes: Json
              p_nombre: string
            }
            Returns: string
          }
        | {
            Args: {
              p_descripcion: string
              p_id_categoria: string
              p_id_receta: string
              p_id_subcategoria: string
              p_ingredientes: Json
              p_nombre: string
              p_tiempo_preparacion_min?: number
            }
            Returns: string
          }
      agregar_item_pedido: {
        Args: {
          p_cantidad: number
          p_exclusiones: Json
          p_extras: Json
          p_id_pedido: string
          p_id_producto: string
          p_nota: string
          p_tiene_alergia: boolean
        }
        Returns: string
      }
      ajustar_stock_manual: {
        Args: {
          p_id_insumo: string
          p_motivo: string
          p_nueva_cantidad: number
        }
        Returns: number
      }
      asignar_mesero_a_mesa: { Args: { p_id_mesa: string }; Returns: string }
      avanzar_estado_item: {
        Args: { p_id_item: string; p_nuevo_estado: string }
        Returns: string
      }
      calcular_costo_items: { Args: { p_item_ids: string[] }; Returns: Json }
      calcular_propinas_por_usuario: {
        Args: { _desde: string; _hasta: string }
        Returns: {
          dias_activos: number
          id_usuario: string
          nombre: string
          rol: Database["public"]["Enums"]["rol_staff"]
          total_propinas: number
        }[]
      }
      cerrar_caja: {
        Args: {
          p_datafono_fisico: number
          p_efectivo_fisico: number
          p_nota: string
        }
        Returns: string
      }
      cerrar_cuenta_mesa: { Args: { p_id_mesa: string }; Returns: number }
      cerrar_mesa: { Args: { p_id_mesa: string }; Returns: undefined }
      cerrar_turnos_vencidos: { Args: never; Returns: number }
      confirmar_pago_transferencia: {
        Args: { p_aprobar: boolean; p_id_pago: string }
        Returns: undefined
      }
      confirmar_pedido: { Args: { p_id_pedido: string }; Returns: undefined }
      crear_pedido_para_mesa: { Args: { p_id_mesa: string }; Returns: string }
      crear_receta:
        | {
            Args: {
              p_descripcion: string
              p_id_categoria: string
              p_id_subcategoria: string
              p_ingredientes: Json
              p_nombre: string
            }
            Returns: string
          }
        | {
            Args: {
              p_descripcion: string
              p_id_categoria: string
              p_id_subcategoria: string
              p_ingredientes: Json
              p_nombre: string
              p_tiempo_preparacion_min?: number
            }
            Returns: string
          }
      current_user_negocio: { Args: never; Returns: string }
      descontar_inventario_item: {
        Args: { p_id_item: string }
        Returns: undefined
      }
      duplicar_receta: { Args: { p_id_receta: string }; Returns: string }
      editar_item_pedido: {
        Args: {
          p_cantidad: number
          p_id_item: string
          p_nota: string
          p_tiene_alergia: boolean
        }
        Returns: undefined
      }
      eliminar_item_pedido: { Args: { p_id_item: string }; Returns: undefined }
      eliminar_receta: { Args: { p_id_receta: string }; Returns: undefined }
      finalizar_turno: { Args: never; Returns: undefined }
      guardar_extras_producto: {
        Args: { p_extras: Json; p_id_producto: string }
        Returns: undefined
      }
      iniciar_comanda_estacion: {
        Args: { p_destino: string; p_id_pedido: string }
        Returns: number
      }
      iniciar_turno: { Args: never; Returns: undefined }
      is_admin_actual: { Args: never; Returns: boolean }
      limpiar_solicitud_cliente: {
        Args: { p_id_mesa: string }
        Returns: undefined
      }
      marcar_pedido_entregado: {
        Args: { p_id_pedido: string }
        Returns: number
      }
      marcar_seguimiento_visto: {
        Args: { p_id_pedido: string }
        Returns: undefined
      }
      pagar_con_abono_reserva: {
        Args: { p_id_mesa: string; p_id_reserva: string; p_item_ids: string[] }
        Returns: string
      }
      purgar_prepedido_inactivo: { Args: never; Returns: number }
      recalcular_total_pedido: {
        Args: { p_id_pedido: string }
        Returns: undefined
      }
      registrar_compra: {
        Args: {
          p_fecha_compra: string
          p_id_proveedor: string
          p_items: Json
          p_numero_factura: string
          p_observaciones: string
        }
        Returns: string
      }
      registrar_negocio_y_admin: {
        Args: {
          p_correo: string
          p_direccion: string
          p_documento_tributario: string
          p_nombre: string
          p_nombre_comercial: string
          p_razon_social: string
          p_telefono: string
          p_user_id: string
        }
        Returns: string
      }
      registrar_pago: {
        Args: {
          p_id_bono?: string
          p_id_mesa: string
          p_item_ids: string[]
          p_metodo: Database["public"]["Enums"]["metodo_pago"]
          p_propina?: number
          p_subtipo: string
          p_url_comprobante: string
          p_voucher: string
        }
        Returns: string
      }
      resumen_caja_dia: { Args: never; Returns: Json }
      solicitar_accion_cliente: {
        Args: { p_id_mesa: string; p_tipo: string }
        Returns: undefined
      }
    }
    Enums: {
      estado_pago: "CONFIRMADO" | "PENDIENTE" | "RECHAZADO"
      estado_pedido:
        | "ABIERTO"
        | "CONFIRMADO"
        | "CERRADO"
        | "CANCELADO"
        | "PAGADO"
        | "PARCIAL"
      estado_staff: "ACTIVO" | "INACTIVO" | "SUSPENDIDO"
      metodo_pago: "EFECTIVO" | "TRANSFERENCIA" | "DATAFONO" | "ABONO_RESERVA"
      rol_staff:
        | "SUPERADMIN"
        | "ADMIN"
        | "MESERO"
        | "COCINA"
        | "BARRA"
        | "CAJERO"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      estado_pago: ["CONFIRMADO", "PENDIENTE", "RECHAZADO"],
      estado_pedido: [
        "ABIERTO",
        "CONFIRMADO",
        "CERRADO",
        "CANCELADO",
        "PAGADO",
        "PARCIAL",
      ],
      estado_staff: ["ACTIVO", "INACTIVO", "SUSPENDIDO"],
      metodo_pago: ["EFECTIVO", "TRANSFERENCIA", "DATAFONO", "ABONO_RESERVA"],
      rol_staff: ["SUPERADMIN", "ADMIN", "MESERO", "COCINA", "BARRA", "CAJERO"],
    },
  },
} as const
