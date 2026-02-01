/* eslint-disable @typescript-eslint/no-explicit-any */
import { X, FileText, Calendar, Building, DollarSign } from 'lucide-react';
import { CurrencyValue } from '../atoms';

interface DetailModalProps {
    invoice: any;
    isOpen: boolean;
    onClose: () => void;
}

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
                    <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                        <X size={24} />
                    </button>
                </div>

                <div className="custom-scrollbar" style={{ padding: '1.5rem', overflowY: 'auto' }}>
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
                                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontFamily: 'monospace', color: 'var(--success-color)' }}>
                                            -<CurrencyValue value={invoice.descuentos} />
                                        </td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(245, 158, 11, 0.05)' }}>
                                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                                            <div style={{ fontWeight: 600 }}>Impuestos</div>
                                            <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                                                {invoice.iva_19 > 0 && <div>IVA 19%: <CurrencyValue value={invoice.iva_19} /></div>}
                                                {invoice.iva_5 > 0 && <div>IVA 5%: <CurrencyValue value={invoice.iva_5} /></div>}
                                                {invoice.inc > 0 && <div>INC: <CurrencyValue value={invoice.inc} /></div>}
                                                {/* Mostrar otros impuestos */}
                                                {(invoice.iva_0 > 0 || invoice.inc_bolsas > 0 || invoice.otros_impuestos > 0) &&
                                                    <div>Otros: <CurrencyValue value={(invoice.iva_0 || 0) + (invoice.inc_bolsas || 0) + (invoice.otros_impuestos || 0)} /></div>
                                                }
                                            </div>
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                                            <CurrencyValue value={(invoice.iva_19 || 0) + (invoice.iva_5 || 0) + (invoice.iva_0 || 0) + (invoice.inc || 0) + (invoice.inc_bolsas || 0) + (invoice.otros_impuestos || 0)} />
                                        </td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(59, 130, 246, 0.05)' }}>
                                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                                            <div style={{ fontWeight: 600 }}>Retenciones</div>
                                            <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                                                {invoice.retefuente > 0 && <div>ReteFuente: <CurrencyValue value={invoice.retefuente} /></div>}
                                                {invoice.reteica > 0 && <div>ReteICA: <CurrencyValue value={invoice.reteica} /></div>}
                                                {invoice.reteiva > 0 && <div>ReteIVA: <CurrencyValue value={invoice.reteiva} /></div>}
                                            </div>
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: 'var(--danger-color)' }}>
                                            -<CurrencyValue value={(invoice.retefuente || 0) + (invoice.reteica || 0) + (invoice.reteiva || 0)} />
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
