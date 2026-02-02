/* eslint-disable @typescript-eslint/no-explicit-any */
import { X, FileText, Calendar, Building, DollarSign, AlertCircle, CheckCircle2, FileCode } from 'lucide-react';
import { CurrencyValue } from '../atoms';

interface DetailModalProps {
    invoice: any;
    isOpen: boolean;
    onClose: () => void;
}

// Función para obtener el badge de estado
const getStatusBadge = (status: string) => {
    const statusConfig = {
        'consistent': {
            label: 'Consistente',
            bg: 'rgba(34, 197, 94, 0.1)',
            border: 'rgba(34, 197, 94, 0.3)',
            color: '#16a34a'
        },
        'success': {
            label: 'OK',
            bg: 'rgba(34, 197, 94, 0.1)',
            border: 'rgba(34, 197, 94, 0.3)',
            color: '#16a34a'
        },
        'duplicate': {
            label: 'Duplicada',
            bg: 'rgba(245, 158, 11, 0.1)',
            border: 'rgba(245, 158, 11, 0.3)',
            color: '#d97706'
        },
        'inconsistent': {
            label: 'Inconsistente',
            bg: 'rgba(245, 158, 11, 0.1)',
            border: 'rgba(245, 158, 11, 0.3)',
            color: '#d97706'
        },
        'error': {
            label: 'Error',
            bg: 'rgba(239, 68, 68, 0.1)',
            border: 'rgba(239, 68, 68, 0.3)',
            color: '#ef4444'
        },
        'pending': {
            label: 'Pendiente',
            bg: 'rgba(148, 163, 184, 0.1)',
            border: 'rgba(148, 163, 184, 0.3)',
            color: '#64748b'
        }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;

    return (
        <div style={{
            padding: '0.4rem 0.75rem',
            borderRadius: '6px',
            backgroundColor: config.bg,
            border: `1px solid ${config.border}`,
            color: config.color,
            fontSize: '0.75rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
        }}>
            {config.label}
        </div>
    );
};

// Función para explicar el estado
const getStatusExplanation = (status: string, invoice: any) => {
    if (status === 'duplicate') {
        return 'Esta factura ya existe en la base de datos. Se identificó como duplicada por la combinación de NIT del proveedor + número de factura. No será importada nuevamente.';
    }
    if (status === 'inconsistent') {
        const diff = Math.abs(invoice.xml_total - invoice.total);
        return `Esta factura presenta inconsistencias porque el total leído del archivo XML/PDF (${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(invoice.xml_total)}) difiere del total calculado por el sistema (${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(invoice.total)}) en ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(diff)}. Esto puede deberse a diferencias en el cálculo de impuestos, retenciones, o errores en el archivo original.`;
    }
    if (status === 'consistent' || status === 'success') {
        return 'Esta factura es consistente. El total leído del archivo XML/PDF coincide con el total calculado por el sistema.';
    }
    if (status === 'error') {
        return invoice.message || 'Error al procesar esta factura. Verifique el formato del archivo XML.';
    }
    return 'Estado pendiente de validación.';
};

export function DetailModal({ invoice, isOpen, onClose }: DetailModalProps) {
    if (!isOpen || !invoice) return null;

    return (
        <div className="modal-overlay" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)', zIndex: 1100,
            display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)'
        }}>
            <div className="modal-content" style={{
                backgroundColor: '#ffffff', borderRadius: '16px', width: '800px', maxHeight: '90vh',
                display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)'
            }}>
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ padding: '0.5rem', borderRadius: '8px', backgroundColor: 'var(--accent-light)', color: 'var(--accent-color)' }}>
                            <FileText size={20} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Detalle de Factura</h3>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{invoice.nombre_xml}</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        {getStatusBadge(invoice.status || 'pending')}
                        <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                            <X size={24} />
                        </button>
                    </div>
                </div>

                <div className="custom-scrollbar" style={{ padding: '1.5rem', overflowY: 'auto' }}>
                    {/* Estado Explanation Section */}
                    {invoice.status && (
                        <div style={{ marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>
                                <AlertCircle size={14} /> Estado de la Factura
                            </div>
                            <div style={{
                                backgroundColor: invoice.status === 'inconsistent' ? 'rgba(245, 158, 11, 0.05)' : 'rgba(34, 197, 94, 0.05)',
                                border: invoice.status === 'inconsistent' ? '1px solid rgba(245, 158, 11, 0.2)' : '1px solid rgba(34, 197, 94, 0.2)',
                                borderRadius: '8px',
                                padding: '1rem',
                                fontSize: '0.85rem',
                                color: 'var(--text-secondary)',
                                lineHeight: '1.6'
                            }}>
                                {getStatusExplanation(invoice.status, invoice)}
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                        <div className="detail-group">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>
                                <Building size={14} /> Información del Emisor
                            </div>
                            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px' }}>
                                <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.25rem' }}>{invoice.sender}</div>
                                <div className="font-mono" style={{ color: 'var(--text-secondary)' }}>NIT: {invoice.nit}</div>
                            </div>
                        </div>
                        <div className="detail-group">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>
                                <Calendar size={14} /> Detalles Generales
                            </div>
                            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Fecha Emisión</div>
                                    <div style={{ fontWeight: 600 }}>{invoice.date}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Número Factura</div>
                                    <div style={{ fontWeight: 600 }}>{invoice.subject}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Comparison / Consistency Section */}
                    {invoice.xml_total !== undefined && (
                        <div style={{ marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>
                                <CheckCircle2 size={14} /> Validación de Importes
                            </div>
                            <div style={{
                                backgroundColor: invoice.status === 'inconsistent' ? 'rgba(245, 158, 11, 0.05)' : 'var(--bg-secondary)',
                                border: invoice.status === 'inconsistent' ? '1px solid rgba(245, 158, 11, 0.2)' : '1px solid var(--border-color)',
                                borderRadius: '8px', padding: '1rem'
                            }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Total Leído (XML/PDF)</div>
                                        <div style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'monospace' }}><CurrencyValue value={invoice.xml_total} /></div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Diferencia</div>
                                        <div style={{
                                            fontSize: '0.85rem', fontWeight: 700, fontFamily: 'monospace',
                                            color: Math.abs(invoice.xml_total - invoice.total) > 1 ? 'var(--danger-color)' : 'var(--success-color)'
                                        }}>
                                            {Math.abs(invoice.xml_total - invoice.total) < 1 ? 'Correcto' : <CurrencyValue value={invoice.xml_total - invoice.total} />}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Total Calculado (Sistema)</div>
                                        <div style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--success-color)' }}><CurrencyValue value={invoice.total} /></div>
                                    </div>
                                </div>
                                {invoice.message && (
                                    <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(0,0,0,0.05)', fontSize: '0.85rem', color: invoice.status === 'inconsistent' ? '#b45309' : 'var(--text-secondary)', display: 'flex', gap: '0.5rem' }}>
                                        <AlertCircle size={14} style={{ marginTop: '2px', flexShrink: 0 }} />
                                        <span>{invoice.message}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Detalle del Registro XML */}
                    {invoice.tax_details && invoice.tax_details.length > 0 && (
                        <div style={{ marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>
                                <FileCode size={14} /> Detalle del Registro XML
                            </div>
                            <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-color)' }}>
                                            <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Concepto</th>
                                            <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>Tipo</th>
                                            <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>Tasa</th>
                                            <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>Monto</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {invoice.tax_details.map((tax: any, idx: number) => {
                                            // Support both formats: from import (operation) and from database (tax_category)
                                            const category = tax.tax_category || tax.operation || 'tax';
                                            const isRetention = category === 'subtract' || category === 'retention' || category === 'retencion';
                                            const isIgnored = category === 'ignore';
                                            const amount = tax.amount ?? tax.valor ?? 0;
                                            return (
                                                <tr key={idx} style={{
                                                    borderBottom: idx < invoice.tax_details.length - 1 ? '1px solid var(--border-color)' : 'none',
                                                    backgroundColor: isIgnored ? 'rgba(148, 163, 184, 0.05)' : isRetention ? 'rgba(239, 68, 68, 0.05)' : 'rgba(34, 197, 94, 0.05)'
                                                }}>
                                                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-primary)' }}>
                                                        <div style={{ fontWeight: 600 }}>{tax.tax_name}</div>
                                                        {tax.tax_code && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>Código: {tax.tax_code}</div>}
                                                    </td>
                                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                                        <span style={{
                                                            padding: '0.25rem 0.5rem',
                                                            borderRadius: '4px',
                                                            fontSize: '0.7rem',
                                                            fontWeight: 600,
                                                            backgroundColor: isIgnored ? 'rgba(148, 163, 184, 0.1)' : isRetention ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                                                            color: isIgnored ? '#64748b' : isRetention ? '#dc2626' : '#16a34a'
                                                        }}>
                                                            {isIgnored ? 'Ignorado' : isRetention ? 'Retención' : 'Impuesto'}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontFamily: 'monospace', fontWeight: 600 }}>
                                                        {tax.percentage ? `${tax.percentage}%` : 'N/A'}
                                                    </td>
                                                    <td style={{
                                                        padding: '0.75rem 1rem',
                                                        textAlign: 'right',
                                                        fontFamily: 'monospace',
                                                        fontWeight: 700
                                                    }}>
                                                        <CurrencyValue value={amount} />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    <div style={{ marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>
                            <DollarSign size={14} /> Desglose Financiero
                        </div>
                        <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                <tbody>
                                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>Subtotal</td>
                                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                                            <CurrencyValue value={invoice.subtotal} />
                                        </td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>Descuentos</td>
                                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>
                                            <CurrencyValue value={-invoice.descuentos} />
                                        </td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(245, 158, 11, 0.05)' }}>
                                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                                            <div style={{ fontWeight: 600 }}>Impuestos</div>
                                            <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                                                {invoice.tax_details?.filter((t: any) => {
                                                    const cat = t.tax_category || t.operation || 'tax';
                                                    return cat !== 'subtract' && cat !== 'retention' && cat !== 'retencion' && cat !== 'ignore';
                                                }).map((t: any, idx: number) => (
                                                    <div key={idx}>{t.tax_name} ({t.percentage}%): <CurrencyValue value={t.amount ?? t.valor ?? 0} /></div>
                                                ))}
                                                {(!invoice.tax_details || invoice.tax_details.length === 0) && invoice.impuestos > 0 && <div>Total: <CurrencyValue value={invoice.impuestos} /></div>}
                                            </div>
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                                            <CurrencyValue value={invoice.impuestos + (invoice.otros_impuestos || 0)} />
                                        </td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(239, 68, 68, 0.05)' }}>
                                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                                            <div style={{ fontWeight: 600 }}>Retenciones</div>
                                            <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                                                {invoice.tax_details?.filter((t: any) => {
                                                    const cat = t.tax_category || t.operation || '';
                                                    return cat === 'subtract' || cat === 'retention' || cat === 'retencion';
                                                }).map((t: any, idx: number) => (
                                                    <div key={idx}>{t.tax_name} ({t.percentage}%): <CurrencyValue value={t.amount ?? t.valor ?? 0} /></div>
                                                ))}
                                                {(!invoice.tax_details || invoice.tax_details.length === 0) && invoice.retenciones > 0 && <div>Total: <CurrencyValue value={-invoice.retenciones} /></div>}
                                            </div>
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>
                                            <CurrencyValue value={-invoice.retenciones} />
                                        </td>
                                    </tr>
                                    <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                                        <td style={{ padding: '1rem', fontWeight: 700, fontSize: '1.1rem' }}>Total</td>
                                        <td style={{ padding: '1rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, fontSize: '1.2rem', color: 'var(--success-color)' }}>
                                            <CurrencyValue value={invoice.total} />
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {invoice.validation_error && (
                        <div style={{ padding: '1rem', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--danger-color)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ fontWeight: 600 }}>Nota del Sistema:</div>
                            {invoice.validation_error}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
