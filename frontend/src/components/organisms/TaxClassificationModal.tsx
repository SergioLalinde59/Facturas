/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { AlertCircle, HelpCircle, Save, X } from 'lucide-react';

interface TaxDefinition {
    code: string;
    description: string;
    context: 'tax' | 'withholding' | 'unknown';
    percent: number;
    amount: number;
}

interface TaxClassificationModalProps {
    definitions: TaxDefinition[];
    isOpen: boolean;
    onClose: () => void;
    onSave: (rules: any[]) => void;
    invoiceContext?: string;
}

export function TaxClassificationModal({ definitions, isOpen, onClose, onSave, invoiceContext }: TaxClassificationModalProps) {
    const [classifications, setClassifications] = useState<Record<string, any>>({});

    if (!isOpen || definitions.length === 0) return null;

    const handleTypeChange = (code: string, type: string) => {
        const def = definitions.find(d => d.code === code);
        let operation = 'add';
        if (type === 'withholding') operation = 'subtract';
        if (type === 'info') operation = 'ignore';

        setClassifications({
            ...classifications,
            [code]: {
                name: classifications[code]?.name || (def?.context === 'withholding' ? 'Retención' : 'Impuesto') + ' ' + code,
                type,
                operation,
                description: classifications[code]?.description || def?.description || 'Clasificado manualmente'
            }
        });
    };

    const handleSave = () => {
        const rulesToSave = Object.entries(classifications).map(([code, data]) => ({
            code,
            ...data
        }));
        onSave(rulesToSave);
    };

    return (
        <div className="modal-overlay" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)', zIndex: 1200,
            display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)'
        }}>
            <div className="modal-content" style={{
                backgroundColor: '#ffffff', borderRadius: '16px', width: '600px', maxHeight: '90vh',
                display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)'
            }}>
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fef2f2' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <AlertCircle size={20} className="text-red-500" />
                        <h3 style={{ margin: 0, color: '#991b1b' }}>Impuestos Desconocidos Detectados</h3>
                    </div>
                    <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={20} /></button>
                </div>

                <div className="custom-scrollbar" style={{ padding: '1.5rem', overflowY: 'auto' }}>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                        El sistema ha detectado códigos de impuestos que no están configurados
                        {invoiceContext ? <><br /><strong style={{ color: 'var(--text-primary)' }}>En la factura: {invoiceContext}</strong></> : '.'}
                        <br />Por favor, clasifícalos para procesar correctamente las facturas.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {definitions.map((def) => {
                            const current = classifications[def.code] || {
                                type: def.context === 'withholding' ? 'withholding' : 'tax',
                                name: (def.context === 'withholding' ? 'Retención' : 'Impuesto') + ' ' + def.code
                            };

                            return (
                                <div key={def.code} style={{
                                    border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem',
                                    backgroundColor: '#fafafa'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                        <div>
                                            <span style={{ fontWeight: 700, fontSize: '1rem' }}>Código: {def.code}</span>
                                            <span style={{ marginLeft: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', backgroundColor: '#eee', padding: '2px 6px', borderRadius: '4px' }}>
                                                Tarifa: {def.percent}%
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                                            Monto: ${def.amount.toLocaleString()}
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Tipo de Concepto</label>
                                            <select
                                                value={current.type}
                                                onChange={(e) => handleTypeChange(def.code, e.target.value)}
                                                style={{
                                                    padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)',
                                                    fontSize: '0.9rem'
                                                }}
                                            >
                                                <option value="tax">Impuesto (Suma)</option>
                                                <option value="withholding">Retención (Resta)</option>
                                                <option value="info">Informativo (Ignorar)</option>
                                            </select>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Nombre Amigable</label>
                                            <input
                                                type="text"
                                                value={current.name}
                                                onChange={(e) => setClassifications({
                                                    ...classifications,
                                                    [def.code]: { ...current, name: e.target.value }
                                                })}
                                                style={{
                                                    padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)',
                                                    fontSize: '0.9rem'
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <HelpCircle size={12} />
                                        Contexto original en XML: {def.context === 'withholding' ? 'Retenciones (<WithholdingTaxTotal>)' : 'Impuestos (<TaxTotal>)'}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '1rem', backgroundColor: '#f9fafb', borderRadius: '0 0 16px 16px' }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '0.6rem 1.2rem', borderRadius: '8px', border: '1px solid var(--border-color)',
                            background: '#fff', cursor: 'pointer', fontWeight: 600
                        }}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        className="btn-primary"
                        style={{
                            padding: '0.6rem 1.2rem', borderRadius: '8px',
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            backgroundColor: 'var(--accent-color)', color: '#fff', border: 'none', cursor: 'pointer'
                        }}
                    >
                        <Save size={16} />
                        Guardar Reglas y Reprocesar
                    </button>
                </div>
            </div>
        </div>
    );
}
