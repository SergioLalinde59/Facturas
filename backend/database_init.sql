-- Script de creación de tabla para facturas
CREATE TABLE IF NOT EXISTS facturas (
    id SERIAL PRIMARY KEY,
    fecha DATE NOT NULL,
    nit VARCHAR(20) NOT NULL,
    proveedor VARCHAR(255) NOT NULL,
    factura VARCHAR(50) NOT NULL,
    subtotal DECIMAL(15, 2) NOT NULL DEFAULT 0,
    iva DECIMAL(15, 2) NOT NULL DEFAULT 0,
    total DECIMAL(15, 2) NOT NULL DEFAULT 0,
    nombre_xml VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Restricción de unicidad para manejar ON CONFLICT en el repositorio
    UNIQUE (nit, factura)
);

-- Índices para mejorar rendimiento en búsquedas
CREATE INDEX IF NOT EXISTS idx_facturas_fecha ON facturas(fecha);
CREATE INDEX IF NOT EXISTS idx_facturas_proveedor ON facturas(proveedor);
