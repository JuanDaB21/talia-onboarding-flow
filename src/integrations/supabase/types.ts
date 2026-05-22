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
      categorias: {
        Row: {
          created_at: string
          id_categoria: string
          id_negocio: string
          nombre: string
        }
        Insert: {
          created_at?: string
          id_categoria?: string
          id_negocio: string
          nombre: string
        }
        Update: {
          created_at?: string
          id_categoria?: string
          id_negocio?: string
          nombre?: string
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
          created_at: string
          estado: string
          id_mesa: string
          id_negocio: string
          identificador: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          estado?: string
          id_mesa?: string
          id_negocio: string
          identificador: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          estado?: string
          id_mesa?: string
          id_negocio?: string
          identificador?: string
          updated_at?: string
        }
        Relationships: []
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
          razon_social: string
          telefono_contacto: string
          url_logo: string | null
        }
        Insert: {
          created_at?: string
          direccion: string
          documento_tributario: string
          estado?: boolean
          id_negocio?: string
          nombre_comercial: string
          razon_social: string
          telefono_contacto: string
          url_logo?: string | null
        }
        Update: {
          created_at?: string
          direccion?: string
          documento_tributario?: string
          estado?: boolean
          id_negocio?: string
          nombre_comercial?: string
          razon_social?: string
          telefono_contacto?: string
          url_logo?: string | null
        }
        Relationships: []
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
      subcategorias: {
        Row: {
          created_at: string
          id_categoria: string
          id_negocio: string
          id_subcategoria: string
          nombre: string
        }
        Insert: {
          created_at?: string
          id_categoria: string
          id_negocio: string
          id_subcategoria?: string
          nombre: string
        }
        Update: {
          created_at?: string
          id_categoria?: string
          id_negocio?: string
          id_subcategoria?: string
          nombre?: string
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
      usuarios_staff: {
        Row: {
          correo: string
          created_at: string
          esta_en_turno: boolean
          estado: Database["public"]["Enums"]["estado_staff"]
          id_negocio: string
          id_usuario: string
          nombre: string
          rol: Database["public"]["Enums"]["rol_staff"]
        }
        Insert: {
          correo: string
          created_at?: string
          esta_en_turno?: boolean
          estado?: Database["public"]["Enums"]["estado_staff"]
          id_negocio: string
          id_usuario: string
          nombre: string
          rol: Database["public"]["Enums"]["rol_staff"]
        }
        Update: {
          correo?: string
          created_at?: string
          esta_en_turno?: boolean
          estado?: Database["public"]["Enums"]["estado_staff"]
          id_negocio?: string
          id_usuario?: string
          nombre?: string
          rol?: Database["public"]["Enums"]["rol_staff"]
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
      actualizar_receta: {
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
      ajustar_stock_manual: {
        Args: {
          p_id_insumo: string
          p_motivo: string
          p_nueva_cantidad: number
        }
        Returns: number
      }
      crear_receta: {
        Args: {
          p_descripcion: string
          p_id_categoria: string
          p_id_subcategoria: string
          p_ingredientes: Json
          p_nombre: string
        }
        Returns: string
      }
      current_user_negocio: { Args: never; Returns: string }
      duplicar_receta: { Args: { p_id_receta: string }; Returns: string }
      eliminar_receta: { Args: { p_id_receta: string }; Returns: undefined }
      guardar_extras_producto: {
        Args: { p_extras: Json; p_id_producto: string }
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
    }
    Enums: {
      estado_staff: "ACTIVO" | "INACTIVO" | "SUSPENDIDO"
      rol_staff: "SUPERADMIN" | "ADMIN" | "MESERO" | "COCINA" | "BARRA"
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
      estado_staff: ["ACTIVO", "INACTIVO", "SUSPENDIDO"],
      rol_staff: ["SUPERADMIN", "ADMIN", "MESERO", "COCINA", "BARRA"],
    },
  },
} as const
