/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useMemo, useEffect } from 'react';
import {
    FileText,
    Building2,
    FileSpreadsheet,
    DollarSign,
    TrendingUp,
    Receipt,
    Download,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Database,
    Tag
} from 'lucide-react';
import { FilterBar, StatCardGrid } from '../components/organisms';
import { CurrencyValue } from '../components/atoms';
import type { Invoice, SortColumn, SortDirection } from '../types';

interface ReportPageProps {
    providers: string[];
}

export function ReportPage({ providers: initialProviders }: ReportPageProps) {
    const [startDate, setStartDate] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    });
    const [endDate, setEndDate] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    });
    const [provider, setProvider] = useState('');
    const [activeQuickFilter, setActiveQuickFilter] = useState<string>('current-month');

    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');
    const [reportData, setReportData] = useState<Invoice[]>([]);

    // Sorting
    const [sortColumn, setSortColumn] = useState<SortColumn>('fecha');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

    const applyQuickFilter = (type: string) => {
        const today = new Date();
        const now = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        let start = new Date(now);
        let end = new Date(now);

        switch (type) {
            case 'current-month': start = new Date(now.getFullYear(), now.getMonth(), 1); break;
            case 'last-month': start = new Date(now.getFullYear(), now.getMonth() - 1, 1); end = new Date(now.getFullYear(), now.getMonth(), 0); break;
            case 'last-3-months': start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()); break;
            case 'last-6-months': start = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()); break;
            case 'ytd': start = new Date(now.getFullYear(), 0, 1); break;
            case 'last-year': start = new Date(now.getFullYear() - 1, 0, 1); end = new Date(now.getFullYear() - 1, 11, 31); break;
            case 'last-12-months': start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()); break;
            default: return;
        }

        const formatDate = (date: Date) => {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        };

        setStartDate(formatDate(start));
        if (type === 'last-month' || type === 'last-year') setEndDate(formatDate(end));
        else setEndDate(formatDate(end));
        setActiveQuickFilter(type);
    };

    const handleGetReport = async () => {
        setStatus('loading');
        setReportData([]);
        try {
            const query = new URLSearchParams();
            if (startDate) query.append('start_date', startDate);
            if (endDate) query.append('end_date', endDate);
            if (provider) query.append('provider', provider);

            const response = await fetch(`/api/v1/invoices?${query.toString()}`);
            const data = await response.json();

            if (!response.ok) throw new Error(data.detail || 'Error al consultar facturas');

            setReportData(data.invoices || []);
            setMessage(`Se encontraron ${data.count} facturas.`);
            setStatus('success');
        } catch (err: any) {
            setMessage(err.message);
            setStatus('error');
        }
    };

    // Auto-fetch on mount and filter change
    useEffect(() => {
        handleGetReport();
    }, [startDate, endDate, provider]);

    const sortedReportData = useMemo(() => {
        if (!reportData.length) return [];
        return [...reportData].sort((a, b) => {
            let comparison = 0;
            switch (sortColumn) {
                case 'fecha': comparison = a.fecha.localeCompare(b.fecha); break;
                case 'proveedor': comparison = a.proveedor.localeCompare(b.proveedor); break;
                case 'nit': comparison = a.nit.localeCompare(b.nit); break;
                case 'factura': comparison = a.factura.localeCompare(b.factura); break;
                case 'subtotal': comparison = a.subtotal - b.subtotal; break;
                case 'impuestos':
                    comparison = (
                        (a.iva_19 + a.iva_5 + a.iva_0 + (a.inc || 0)) -
                        (b.iva_19 + b.iva_5 + b.iva_0 + (b.inc || 0))
                    );
                    break;
                case 'retenciones':
                    comparison = (
                        ((a.retefuente || 0) + (a.reteica || 0) + (a.reteiva || 0)) -
                        ((b.retefuente || 0) + (b.reteica || 0) + (b.reteiva || 0))
                    );
                    break;
                case 'total': comparison = a.total - b.total; break;
            }
            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [reportData, sortColumn, sortDirection]);

    const handleSort = (column: SortColumn) => {
        if (sortColumn === column) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    const getSortIcon = (column: SortColumn) => {
        if (sortColumn !== column) return <ArrowUpDown size={14} style={{ opacity: 0.4 }} />;
        return sortDirection === 'asc'
            ? <ArrowUp size={14} style={{ color: 'var(--accent-color)' }} />
            : <ArrowDown size={14} style={{ color: 'var(--accent-color)' }} />;
    };

    const handleQuickExport = async (formats: { csv: boolean, excel: boolean, pdf: boolean }) => {
        setStatus('loading');
        try {
            const selectedFormats = Object.entries(formats)
                .filter(([_, enabled]) => enabled)
                .map(([format]) => format);

            const response = await fetch('/api/v1/invoices/export-db', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    output_directory: null, // Let backend decide or user default? App.tsx passed NULL in handleExportFromDB(null, formats)
                    formats: selectedFormats,
                    start_date: startDate || null,
                    end_date: endDate || null,
                    provider: provider || null
                }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || data.message || 'Error al exportar');
            setMessage(data.message);
            setStatus('success');
        } catch (err: any) {
            setMessage(err.message);
            setStatus('error');
        }
    };

    return (
        <>
            <div className="filter-section">
                <div style={{ position: 'relative' }}>
                    <FilterBar
                        quickFilters={[
                            { label: 'Mes Actual', active: activeQuickFilter === 'current-month', onClick: () => applyQuickFilter('current-month') },
                            { label: 'Mes Ant.', active: activeQuickFilter === 'last-month', onClick: () => applyQuickFilter('last-month') },
                            { label: 'Últ. 3 Meses', active: activeQuickFilter === 'last-3-months', onClick: () => applyQuickFilter('last-3-months') },
                            { label: 'Últ. 6 Meses', active: activeQuickFilter === 'last-6-months', onClick: () => applyQuickFilter('last-6-months') },
                            { label: 'YTD', active: activeQuickFilter === 'ytd', onClick: () => applyQuickFilter('ytd') },
                            { label: 'Año Ant.', active: activeQuickFilter === 'last-year', onClick: () => applyQuickFilter('last-year') },
                            { label: '12 Meses', active: activeQuickFilter === 'last-12-months', onClick: () => applyQuickFilter('last-12-months') },
                        ]}
                        dateRange={{
                            startDate,
                            endDate,
                            onStartDateChange: setStartDate,
                            onEndDateChange: setEndDate
                        }}
                        provider={{
                            value: provider,
                            options: initialProviders,
                            onChange: setProvider
                        }}
                    />
                </div>
            </div>

            {/* Status Message */}
            {status !== 'idle' && message && (
                <div className="data-card" style={{
                    marginBottom: '1rem', padding: '0.75rem 1rem',
                    borderColor: status === 'success' ? 'rgba(16, 185, 129, 0.3)' : status === 'error' ? 'rgba(239, 68, 68, 0.3)' : 'var(--border-color)',
                    backgroundColor: status === 'success' ? 'rgba(16, 185, 129, 0.05)' : status === 'error' ? 'rgba(239, 68, 68, 0.05)' : 'var(--bg-secondary)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {status === 'success' ? <CheckCircle2 size={18} color="var(--success-color)" /> : status === 'error' ? <AlertCircle size={18} color="var(--danger-color)" /> : <Loader2 size={18} className="animate-spin" color="var(--accent-color)" />}
                        <p style={{ fontSize: '0.875rem', color: status === 'success' ? 'var(--success-color)' : status === 'error' ? 'var(--danger-color)' : 'var(--text-secondary)' }}>{message}</p>
                    </div>
                </div>
            )}

            {status === 'success' && (
                <div style={{ marginBottom: '1rem' }}>
                    <StatCardGrid
                        stats={[
                            {
                                id: 'count',
                                label: 'Facturas',
                                value: reportData.length,
                                icon: <Receipt size={18} />,
                                variant: 'primary'
                            },
                            {
                                id: 'providers',
                                label: 'Proveedores',
                                value: new Set(reportData.map(inv => inv.nit)).size,
                                icon: <Building2 size={18} />,
                                variant: 'info'
                            },
                            {
                                id: 'subtotal',
                                label: 'Subtotal',
                                value: <CurrencyValue value={reportData.reduce((sum, inv) => sum + inv.subtotal, 0)} />,
                                icon: <FileSpreadsheet size={18} />,
                                variant: reportData.reduce((sum, inv) => sum + inv.subtotal, 0) >= 0 ? 'success' : 'error'
                            },
                            {
                                id: 'descuentos',
                                label: 'Descuentos',
                                value: <CurrencyValue value={-reportData.reduce((sum, inv) => sum + (inv.descuentos || 0), 0)} />,
                                icon: <FileText size={18} />,
                                variant: 'error'
                            },
                            {
                                id: 'impuestos',
                                label: 'Impuestos',
                                value: (
                                    <CurrencyValue
                                        value={reportData.reduce(
                                            (sum, inv) =>
                                                sum +
                                                inv.iva_19 +
                                                inv.iva_5 +
                                                inv.iva_0 +
                                                (inv.inc || 0),
                                            0
                                        )}
                                    />
                                ),
                                icon: <Tag size={18} />,
                                variant: 'warning'
                            },
                            {
                                id: 'retenciones',
                                label: 'Retenciones',
                                value: <CurrencyValue value={-reportData.reduce((sum, inv) => sum + (inv.retefuente || 0) + (inv.reteica || 0) + (inv.reteiva || 0), 0)} />,
                                icon: <DollarSign size={18} />,
                                variant: 'error'
                            },
                            {
                                id: 'total',
                                label: 'Total',
                                value: <CurrencyValue value={reportData.reduce((sum, inv) => sum + inv.total, 0)} />,
                                icon: <TrendingUp size={18} />,
                                variant: reportData.reduce((sum, inv) => sum + inv.total, 0) >= 0 ? 'success' : 'error'
                            }
                        ]}
                        columns={7}
                    />
                </div>
            )}

            {status === 'success' && (
                <div className="data-card">
                    <div className="data-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="data-card-title">Resultados</span>
                        <div style={{ display: 'flex', gap: '16px' }}>
                            <button
                                onClick={() => handleQuickExport({ excel: true, csv: false, pdf: false })}
                                className="btn-icon"
                                title="Exportar a Excel"
                                style={{ color: '#16a34a', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer' }}
                            >
                                <FileSpreadsheet size={24} />
                                <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)' }}>EXCEL</span>
                            </button>
                            <button
                                onClick={() => handleQuickExport({ excel: false, csv: true, pdf: false })}
                                className="btn-icon"
                                title="Exportar a CSV"
                                style={{ color: '#0284c7', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer' }}
                            >
                                <Database size={24} />
                                <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)' }}>CSV</span>
                            </button>
                            <button
                                onClick={() => handleQuickExport({ excel: false, csv: false, pdf: true })}
                                className="btn-icon"
                                title="Exportar a PDF"
                                style={{ color: '#dc2626', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer' }}
                            >
                                <Download size={24} />
                                <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)' }}>PDF</span>
                            </button>
                        </div>
                    </div>
                    <div className="data-card-content custom-scrollbar" style={{ overflowY: 'scroll', height: '750px' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th className="sortable-header" onClick={() => handleSort('fecha')}><span>Fecha</span>{getSortIcon('fecha')}</th>
                                    <th className="sortable-header" onClick={() => handleSort('proveedor')}><span>Proveedor</span>{getSortIcon('proveedor')}</th>
                                    <th className="sortable-header" onClick={() => handleSort('nit')}><span>Nit</span>{getSortIcon('nit')}</th>
                                    <th className="sortable-header" onClick={() => handleSort('factura')}><span>Factura</span>{getSortIcon('factura')}</th>
                                    <th className="sortable-header" style={{ textAlign: 'right' }} onClick={() => handleSort('subtotal')}><span>Subtotal</span>{getSortIcon('subtotal')}</th>
                                    <th className="sortable-header" style={{ textAlign: 'right' }} onClick={() => handleSort('descuentos')}><span>Descuentos</span>{getSortIcon('descuentos')}</th>
                                    <th className="sortable-header" style={{ textAlign: 'right' }} onClick={() => handleSort('impuestos')}><span>Impuestos</span>{getSortIcon('impuestos')}</th>
                                    <th className="sortable-header" style={{ width: '100px', textAlign: 'right' }} onClick={() => handleSort('retenciones')}><span>Retenciones</span>{getSortIcon('retenciones')}</th>
                                    <th className="sortable-header" style={{ textAlign: 'right' }} onClick={() => handleSort('total')}><span>Total</span>{getSortIcon('total')}</th>
                                    <th style={{ width: '50px', textAlign: 'center' }}>PDF</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedReportData.map((inv, idx) => (
                                    <tr key={`${inv.nit}-${inv.factura}-${idx}`}>
                                        <td>{inv.fecha}</td>
                                        <td style={{ fontWeight: 500 }}>{inv.proveedor}</td>
                                        <td className="font-mono" style={{ fontSize: '0.85rem' }}>{inv.nit}</td>
                                        <td className="font-mono" style={{ fontSize: '0.85rem' }}>{inv.factura}</td>
                                        <td style={{ textAlign: 'right', fontWeight: 500 }} className="font-mono"><CurrencyValue value={inv.subtotal} /></td>
                                        <td style={{ textAlign: 'right', fontWeight: 500 }} className="font-mono"><CurrencyValue value={-inv.descuentos} /></td>
                                        <td style={{ textAlign: 'right', fontWeight: 500 }} className="font-mono">
                                            <CurrencyValue value={
                                                inv.iva_19 +
                                                inv.iva_5 +
                                                inv.iva_0 +
                                                (inv.inc || 0)
                                            } />
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: 500 }} className="font-mono">
                                            <CurrencyValue value={-(inv.retefuente || 0) - (inv.reteica || 0) - (inv.reteiva || 0)} />
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: 600 }} className="font-mono"><CurrencyValue value={inv.total} /></td>
                                        <td style={{ textAlign: 'center' }}>
                                            <a
                                                href={`/api/v1/utils/view-file?path=${encodeURIComponent(`/app/data/Data/Procesadas/${inv.fecha.substring(0, 4)}/${inv.nombre_xml.replace('.xml', '.pdf')}`)}`}
                                                target="_blank" rel="noopener noreferrer"
                                                className="btn-icon" title="Ver PDF"
                                                style={{ color: 'var(--danger-color)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '4px', borderRadius: '4px', transition: 'background-color 0.2s' }}
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                            >
                                                <FileText size={18} />
                                            </a>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </>
    );
}
