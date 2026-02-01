-- Script de creación de tabla para facturas
-- Se asume que las tablas están vacías, por lo que se utiliza DROP/CREATE para reiniciar el esquema normalizado.

DROP TABLE IF EXISTS facturas_detalle CASCADE;
DROP TABLE IF EXISTS tax_rates CASCADE;
DROP TABLE IF EXISTS taxes CASCADE;
DROP TABLE IF EXISTS agrupaciones CASCADE;
DROP TABLE IF EXISTS facturas CASCADE;

-- Tabla de Agrupaciones (Conceptos Generales de Suma/Resta)
CREATE TABLE IF NOT EXISTS agrupaciones (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    operation VARCHAR(20) NOT NULL, -- 'add', 'subtract', 'ignore'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_agrupaciones_name UNIQUE (name)
);

-- Seed inicial para Agrupaciones
INSERT INTO agrupaciones (name, operation) VALUES
    ('Descuentos', 'subtract'),
    ('Impuestos', 'add'),
    ('Retenciones', 'subtract'),
    ('Ignorar', 'ignore')
ON CONFLICT (name) DO NOTHING;

-- Tabla de Impuestos (Conceptos Definidos por DIAN o Negocio)
-- Define QUE es (IVA, ICA, ReteFuente, etc.)
CREATE TABLE IF NOT EXISTS taxes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(10) NOT NULL, -- '01', '03', '04', etc.
    name VARCHAR(100) NOT NULL, -- 'IVA', 'INC', 'ICA'
    agrupacion_id INTEGER,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_taxes_code UNIQUE (code),
    CONSTRAINT fk_taxes_agrupacion FOREIGN KEY (agrupacion_id) REFERENCES agrupaciones(id)
);

-- Tabla de Tarifas (Tax Rates)
-- Define el CUANTO (19%, 0.966%, etc.)
CREATE TABLE IF NOT EXISTS tax_rates (
    id SERIAL PRIMARY KEY,
    tax_id INTEGER NOT NULL, -- Link al concepto (Ej: Link a IVA '01')
    percentage DECIMAL(10, 6) NOT NULL, -- Permite hasta 9999.999999%
    name VARCHAR(100) NOT NULL, -- 'IVA General', 'ICA Bogotá'
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_tax_rates_tax FOREIGN KEY (tax_id) REFERENCES taxes(id)
);

-- Seed inicial para Tasas Comunes de IVA
-- Nota: Se insertarán dinámicamente si el backend lo requiere, pero es bueno tener las base.
-- (Se requiere que existan los Taxes primero, se hará en lógica de aplicación o script posterior si es necesario, 
--  pero aquí creamos la estructura).

-- Tabla de Facturas (Encabezado)
CREATE TABLE IF NOT EXISTS facturas (
    id SERIAL PRIMARY KEY,
    fecha DATE NOT NULL,
    nit VARCHAR(20) NOT NULL,
    proveedor VARCHAR(255) NOT NULL,
    factura VARCHAR(50) NOT NULL,
    
    -- Totales Financieros Agregados (Para consultas rápidas)
    subtotal DECIMAL(15, 2) NOT NULL DEFAULT 0,
    descuentos DECIMAL(15, 2) NOT NULL DEFAULT 0,
    impuestos DECIMAL(15, 2) NOT NULL DEFAULT 0, -- Suma de todos los impuestos (IVA, INC, etc)
    retenciones DECIMAL(15, 2) NOT NULL DEFAULT 0, -- Suma de todas las retenciones
    total DECIMAL(15, 2) NOT NULL DEFAULT 0, -- Total a Pagar
    
    otros_impuestos DECIMAL(15, 2) NOT NULL DEFAULT 0, -- Bolsas, Timbre, etc (Subconjunto de impuestos)
    
    -- JSON para detalles no estructurados o logs de operaciones
    -- schema: [{"name": "X", "amount": 100, "operation": "add"}]
    otros_conceptos JSONB, 
    
    nombre_pdf VARCHAR(255),
    nombre_xml VARCHAR(255),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Restricción de unicidad
    UNIQUE (nit, factura)
);

-- Índices Facuras
CREATE INDEX IF NOT EXISTS idx_facturas_fecha ON facturas(fecha);
CREATE INDEX IF NOT EXISTS idx_facturas_proveedor ON facturas(proveedor);

-- Tabla de Detalle de Facturas (Normalización Vertical)
CREATE TABLE IF NOT EXISTS facturas_detalle (
    id SERIAL PRIMARY KEY,
    fecha DATE NOT NULL, -- Redundancia útil para particionamiento por fecha
    factura_id INTEGER NOT NULL,
    tax_id INTEGER NOT NULL, -- Concepto Base (FK taxes)
    tax_rate_id INTEGER, -- Tasa Específica (FK tax_rates) - Puede ser NULL si es una tasa ad-hoc
    percentage DECIMAL(10, 6) NOT NULL, -- Snapshot de la tasa aplicada en ese momento
    valor DECIMAL(15, 2) NOT NULL DEFAULT 0,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_detalle_factura FOREIGN KEY (factura_id) REFERENCES facturas(id) ON DELETE CASCADE,
    CONSTRAINT fk_detalle_tax FOREIGN KEY (tax_id) REFERENCES taxes(id),
    CONSTRAINT fk_detalle_rate FOREIGN KEY (tax_rate_id) REFERENCES tax_rates(id)
);

-- Índices Detalle
CREATE INDEX IF NOT EXISTS idx_detalle_factura ON facturas_detalle(factura_id);
CREATE INDEX IF NOT EXISTS idx_detalle_tax ON facturas_detalle(tax_id);
