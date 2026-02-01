export interface ProcessingStats {
    total_scanned: number;
    successful: number;
    trashed: number;
    errors: number;
    files_saved: number;
    subtotal_sum: number;
    iva_sum: number;
    total_sum: number;
}

export interface ImportStats {
    total: number;
    successful: number;
    duplicates: number;
    inconsistent: number;
    errors: number;
}

export interface Invoice {
    fecha: string;
    nit: string;
    proveedor: string;
    factura: string;
    subtotal: number;
    descuentos: number;
    iva_19: number;
    iva_5: number;
    iva_0: number;
    inc: number;
    inc_bolsas: number;
    retefuente: number;
    reteica: number;
    reteiva: number;
    otros_impuestos: number;
    total: number;
    nombre_pdf: string;
    nombre_xml: string;
    fecha_creacion: string;
}

export interface DashboardStats {
    total_facturas: number;
    total_subtotal: number;
    total_descuentos: number;
    total_impuestos: number;
    total_retenciones: number;
    total_monto: number;
    total_proveedores: number;
    total_nits: number;
    fecha_min: string | null;
    fecha_max: string | null;
}

export type AppView = 'dashboard' | 'extract' | 'import' | 'export' | 'report';

export type SortColumn = 'fecha' | 'proveedor' | 'nit' | 'factura' | 'subtotal' | 'descuentos' | 'iva_19' | 'iva_5' | 'iva_0' | 'inc' | 'impuestos' | 'total';
export type SortDirection = 'asc' | 'desc';

export type ProcessSortColumn = 'date' | 'sender' | 'nit' | 'subject' | 'subtotal' | 'descuentos' | 'impuestos' | 'retenciones' | 'iva' | 'iva_19' | 'iva_5' | 'iva_0' | 'inc' | 'total' | 'nombre_xml' | 'count' | 'status';
