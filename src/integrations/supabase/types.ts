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
        Relationships: []
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
          unidad_medida: string
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
          unidad_medida: string
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
          unidad_medida?: string
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
        Relationships: []
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
      ajustar_stock_manual: {
        Args: {
          p_id_insumo: string
          p_motivo: string
          p_nueva_cantidad: number
        }
        Returns: number
      }
      current_user_negocio: { Args: never; Returns: string }
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
      rol_staff: "SUPERADMIN" | "ADMIN" | "MESERO" | "COCINA"
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
      rol_staff: ["SUPERADMIN", "ADMIN", "MESERO", "COCINA"],
    },
  },
} as const
