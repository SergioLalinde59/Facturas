-- Script para insertar los códigos de impuestos y retenciones DIAN
-- Ejecutar después de database_init.sql (que ya crea las agrupaciones)

-- 0. Limpiar tablas dependientes primero (orden por FK)
TRUNCATE TABLE tax_rates CASCADE;
TRUNCATE TABLE taxes CASCADE;

-- 1. Asegurar agrupaciones
INSERT INTO agrupaciones (name, operation) VALUES
    ('Descuentos', 'subtract'),
    ('Impuestos', 'add'),
    ('Retenciones', 'subtract'),
    ('Ignorar', 'ignore')
ON CONFLICT (name) DO NOTHING;

-- 2. Insertar Impuestos (operation: add → agrupacion 'Impuestos')
INSERT INTO taxes (code, name, agrupacion_id, description) VALUES
    ('01', 'IVA',              (SELECT id FROM agrupaciones WHERE name = 'Impuestos'),    'Impuesto al Valor Agregado'),
    ('02', 'IC',               (SELECT id FROM agrupaciones WHERE name = 'Impuestos'),    'Impuesto al Consumo'),
    ('03', 'INC',              (SELECT id FROM agrupaciones WHERE name = 'Impuestos'),    'Impuesto Nacional al Consumo'),
    ('04', 'ICA',              (SELECT id FROM agrupaciones WHERE name = 'Impuestos'),    'Impuesto de Industria y Comercio'),
    ('08', 'IPC',              (SELECT id FROM agrupaciones WHERE name = 'Impuestos'),    'Impuesto Público de Consumo'),
    ('09', 'IPO',              (SELECT id FROM agrupaciones WHERE name = 'Impuestos'),    'Impuesto Publicitario y Otros'),
    ('11', 'Otros Impuestos',  (SELECT id FROM agrupaciones WHERE name = 'Impuestos'),    'Otros impuestos departamentales/municipales'),
    ('12', 'Otros Impuestos',  (SELECT id FROM agrupaciones WHERE name = 'Impuestos'),    'Otros impuestos'),
    ('13', 'Otros Impuestos',  (SELECT id FROM agrupaciones WHERE name = 'Impuestos'),    'Otros impuestos'),
    ('14', 'Otros Impuestos',  (SELECT id FROM agrupaciones WHERE name = 'Impuestos'),    'Otros impuestos'),
    ('15', 'Otros Impuestos',  (SELECT id FROM agrupaciones WHERE name = 'Impuestos'),    'Otros impuestos'),
    ('22', 'FtoHorticultura',  (SELECT id FROM agrupaciones WHERE name = 'Impuestos'),    'Fondo de Fomento Hortifrutícola'),
    ('ZZ', 'Otro Impuesto',   (SELECT id FROM agrupaciones WHERE name = 'Impuestos'),    'Impuesto genérico - operación determinada por contexto XML')
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    agrupacion_id = EXCLUDED.agrupacion_id,
    description = EXCLUDED.description;

-- 3. Insertar Retenciones (operation: subtract → agrupacion 'Retenciones')
INSERT INTO taxes (code, name, agrupacion_id, description) VALUES
    ('05', 'ReteFuente', (SELECT id FROM agrupaciones WHERE name = 'Retenciones'), 'Retención en la Fuente'),
    ('06', 'ReteICA',    (SELECT id FROM agrupaciones WHERE name = 'Retenciones'), 'Retención de ICA'),
    ('07', 'ReteIVA',    (SELECT id FROM agrupaciones WHERE name = 'Retenciones'), 'Retención de IVA')
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    agrupacion_id = EXCLUDED.agrupacion_id,
    description = EXCLUDED.description;

-- 4. Insertar Informativos (operation: ignore → agrupacion 'Ignorar')
INSERT INTO taxes (code, name, agrupacion_id, description) VALUES
    ('10', 'Información', (SELECT id FROM agrupaciones WHERE name = 'Ignorar'), 'Solo informativo, no afecta cálculos')
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    agrupacion_id = EXCLUDED.agrupacion_id,
    description = EXCLUDED.description;

-- 5. Insertar Tarifas comunes de IVA (código 01)
INSERT INTO tax_rates (tax_id, percentage, name) VALUES
    ((SELECT id FROM taxes WHERE code = '01'), 19.000000, 'IVA General 19%'),
    ((SELECT id FROM taxes WHERE code = '01'),  5.000000, 'IVA 5%'),
    ((SELECT id FROM taxes WHERE code = '01'),  0.000000, 'IVA 0% / Exento')
ON CONFLICT DO NOTHING;