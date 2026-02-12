/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useMemo, useEffect } from 'react';
import {
    Database,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Eye,
    ArrowUpDown,
    ArrowUp,
    ArrowDown
} from 'lucide-react';
import { FilterBar, TaxClassificationModal, DetailModal } from '../components/organisms';
import { CurrencyValue } from '../components/atoms';
import type { ImportStats, ProcessSortColumn, SortDirection } from '../types';

interface ImportPageProps {
    providers: string[];
    directory: string;
}

export function ImportPage({ providers: initialProviders, directory }: ImportPageProps) {
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
    const [importStats, setImportStats] = useState<ImportStats | null>(null);
    const [processResults, setProcessResults] = useState<any[]>([]);
    const [isPreviewMode, setIsPreviewMode] = useState(false);
    const [selectedImportRows, setSelectedImportRows] = useState<Set<string>>(new Set());
    const [tableStatusFilter, setTableStatusFilter] = useState<'all' | 'success' | 'duplicate' | 'inconsistent' | 'error'>('all');

    // Reprocess State
    const [availableCurrentProviders, setAvailableCurrentProviders] = useState<string[]>([]);
    const [processingFilenames, setProcessingFilenames] = useState<string[] | null>(null);
    const [invoiceContext, setInvoiceContext] = useState<string | undefined>(undefined);

    // Detail Modal State
    const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

    // Tax Classification Modal
    const [missingTaxDefinitions, setMissingTaxDefinitions] = useState<any[]>([]);
    const [isTaxModalOpen, setIsTaxModalOpen] = useState(false);

    // Sorting
    const [processSortColumn, setProcessSortColumn] = useState<ProcessSortColumn>('date');
    const [processSortDirection, setProcessSortDirection] = useState<SortDirection>('desc');

    const applyQuickFilter = (type: string) => {
        const today = new Date();
        const now = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        let start = new Date(now);
        let end = new Date(now);

        switch (type) {
            case 'current-month':
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'last-month':
                start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                end = new Date(now.getFullYear(), now.getMonth(), 0);
                break;
            case 'last-3-months':
                start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
                break;
            case 'last-6-months':
                start = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
                break;
            case 'ytd':
                start = new Date(now.getFullYear(), 0, 1);
                break;
            case 'last-year':
                start = new Date(now.getFullYear() - 1, 0, 1);
                end = new Date(now.getFullYear() - 1, 11, 31);
                break;
            case 'last-12-months':
                start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
                break;
            default:
                return;
        }

        const formatDate = (date: Date) => {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        };

        setStartDate(formatDate(start));
        if (type === 'last-month' || type === 'last-year') {
            setEndDate(formatDate(end));
        } else {
            setEndDate(formatDate(end));
        }
        setActiveQuickFilter(type);
    };

    const handleImportToDB = async (dryRun: boolean = false, targetFiles: string[] | null = null, suppressModal: boolean = false) => {
        setStatus('loading');
        setIsPreviewMode(dryRun);
        setInvoiceContext(undefined);
        try {
            const response = await fetch('/api/v1/invoices/import-db', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    target_directory: directory,
                    dry_run: dryRun,
                    start_date: startDate || null,
                    end_date: endDate || null,
                    provider: provider || null,
                    filenames: targetFiles || processingFilenames || null
                }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || 'Error al importar a base de datos');

            // Check for missing tax definitions
            const missingDefs = new Map<string, any>();
            const contextInvoices: Set<string> = new Set();

            if (data.results) {
                data.results.forEach((res: any) => {
                    if (res.otros_conceptos?.missing_tax_definitions) {
                        res.otros_conceptos.missing_tax_definitions.forEach((def: any) => {
                            missingDefs.set(def.code, def);
                            const ctx = (res.sender && res.sender !== 'Sistema') ? `${res.sender} (${res.subject})` : res.nombre_xml;
                            contextInvoices.add(ctx);
                        });
                    }
                });
            }

            if (missingDefs.size > 0 && !suppressModal) {
                setMissingTaxDefinitions(Array.from(missingDefs.values()));

                // Build context string
                if (contextInvoices.size === 1) {
                    setInvoiceContext(Array.from(contextInvoices)[0]);
                } else if (contextInvoices.size > 1) {
                    const first = Array.from(contextInvoices)[0];
                    setInvoiceContext(`${first} y ${contextInvoices.size - 1} más`);
                }

                setIsTaxModalOpen(true);
            }

            setImportStats(data.stats);
            setProcessResults(data.results || []);

            // Update available providers based on current results if we are viewing 'all'
            if (!provider && data.results && data.results.length > 0) {
                const uniqueSenders = Array.from(new Set(data.results.map((r: any) => r.sender)))
                    .filter(Boolean)
                    .sort() as string[];
                setAvailableCurrentProviders(uniqueSenders);
            }

            setMessage(data.message);
            setStatus('success');
            if (!dryRun) setIsPreviewMode(false);
        } catch (err: any) {
            setMessage(err.message);
            setStatus('error');
        }
    };

    const handleSaveTaxRules = async (rules: any[]) => {
        try {
            const response = await fetch('/api/v1/config/tax-rules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rules }),
            });

            if (!response.ok) throw new Error('Error guardando reglas');

            setIsTaxModalOpen(false);
            setMissingTaxDefinitions([]);
            setInvoiceContext(undefined);
            // Re-run import/preview to apply new rules
            // Uses processed filenames if we were reprocessing a subset
            await handleImportToDB(isPreviewMode);
        } catch (error) {
            console.error(error);
            alert('Error al guardar la configuración de impuestos.');
        }
    };

    const resetProcessState = () => {
        setStatus('idle');
        setMessage('');
        setImportStats(null);
        setProcessResults([]);
        setIsPreviewMode(false);
        setProcessingFilenames(null);
    };

    const importFinancialSums = useMemo(() => {
        // Resumen financiero consistente con el filtro de la tabla
        const filteredResults = processResults.filter(r => {
            if (tableStatusFilter === 'all') return true;
            if (tableStatusFilter === 'success') return r.status === 'success';
            if (tableStatusFilter === 'duplicate') return r.status === 'duplicate';
            if (tableStatusFilter === 'inconsistent') return r.status === 'inconsistent';
            if (tableStatusFilter === 'error') return r.status === 'error' || r.status === 'failed';
            return true;
        });
        
        return filteredResults.reduce((acc, r) => ({
            subtotal: acc.subtotal + (Number(r.subtotal) || 0),
            descuentos: acc.descuentos + (Number(r.descuentos) || 0),
            iva: acc.iva + (Number(r.impuestos) || 0) + (Number(r.otros_impuestos) || 0),
            total: acc.total + (Number(r.total) || 0),
            retefuente: acc.retefuente + (Number(r.retenciones) || 0)
        }), { subtotal: 0, descuentos: 0, iva: 0, total: 0, retefuente: 0 });
    }, [processResults, tableStatusFilter]);

    const sortedProcessResults = useMemo(() => {
        if (!processResults.length) return [];
        return [...processResults].sort((a, b) => {
            let comparison = 0;
            switch (processSortColumn) {
                case 'date': comparison = (a.date || '').localeCompare(b.date || ''); break;
                case 'sender': comparison = (a.sender || '').localeCompare(b.sender || ''); break;
                case 'nit': comparison = (a.nit || '').localeCompare(b.nit || ''); break;
                case 'subject': comparison = (a.subject || '').localeCompare(b.subject || ''); break;
                case 'subtotal': comparison = (a.subtotal || 0) - (b.subtotal || 0); break;
                case 'descuentos': comparison = (a.descuentos || 0) - (b.descuentos || 0); break;
                case 'total': comparison = (a.total || 0) - (b.total || 0); break;
                case 'nombre_xml': comparison = (a.nombre_xml || '').localeCompare(b.nombre_xml || ''); break;
                case 'impuestos': comparison = (a.impuestos || 0) - (b.impuestos || 0); break;
                case 'retenciones': comparison = (a.retenciones || 0) - (b.retenciones || 0); break;
                case 'count': comparison = (a.attachments?.length || 0) - (b.attachments?.length || 0); break;
                case 'status': comparison = (a.status || '').localeCompare(b.status || ''); break;
            }
            return processSortDirection === 'asc' ? comparison : -comparison;
        });
    }, [processResults, processSortColumn, processSortDirection]);

    const handleProcessSort = (column: ProcessSortColumn) => {
        if (processSortColumn === column) {
            setProcessSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setProcessSortColumn(column);
            setProcessSortDirection('asc');
        }
    };

    const getProcessSortIcon = (column: ProcessSortColumn) => {
        if (processSortColumn !== column) return <ArrowUpDown size={14} style={{ opacity: 0.4 }} />;
        return processSortDirection === 'asc'
            ? <ArrowUp size={14} style={{ color: 'var(--accent-color)' }} />
            : <ArrowDown size={14} style={{ color: 'var(--accent-color)' }} />;
    };

    const formatProcessDate = (dateStr: string) => {
        try {
            const isoDate = dateStr.includes('T') ? dateStr.split('T')[0] :
                dateStr.includes(' ') ? dateStr.split(' ')[0] : dateStr;
            const parts = isoDate.split(/[-/]/);
            if (parts.length === 3) {
                const y = parts[0].length === 4 ? parts[0] : parts[2];
                const m = parts[1].padStart(2, '0');
                const d = (parts[0].length === 4 ? parts[2] : parts[0]).padStart(2, '0');
                return `${y}-${m}-${d}`;
            }
            return isoDate;
        } catch (e) { return dateStr; }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            setProcessingFilenames(null); // Clear specific selection when filters change
            handleImportToDB(true, null, true); // Suppress modal on filter change
        }, 500);
        return () => clearTimeout(timer);
    }, [startDate, endDate, provider]);

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
                            options: availableCurrentProviders.length > 0 ? availableCurrentProviders : initialProviders,
                            onChange: setProvider
                        }}
                    >
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '0.875rem',
                            borderLeft: '1px solid var(--border-color)', paddingLeft: '1rem',
                            marginLeft: '0.5rem', height: '38px', minWidth: 'fit-content'
                        }}>
                            {status === 'loading' ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-color)' }}>
                                    <Loader2 size={16} className="animate-spin" />
                                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Analizando...</span>
                                </div>
                            ) : !importStats || !isPreviewMode ? (
                                null

                            ) : (
                                <>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'none', lineHeight: 1, marginBottom: '2px' }}>Previsualización</div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--success-color)', lineHeight: 1 }}>{importStats.successful} Facturas</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                                        <button
                                            onClick={() => resetProcessState()}
                                            style={{
                                                padding: '0.4rem 0.75rem', fontSize: '0.75rem', borderRadius: '6px',
                                                border: '1px solid var(--border-color)', background: '#fff', cursor: 'pointer', fontWeight: 600
                                            }}
                                        >
                                            Cancelar
                                        </button>
                                        {(selectedImportRows.size > 0) && (
                                            <button
                                                onClick={() => {
                                                    const files = Array.from(selectedImportRows);
                                                    console.log('Reprocesando archivos:', files); // Debug
                                                    setProcessingFilenames(files);
                                                    handleImportToDB(false, files, false);
                                                }}
                                                className="btn-primary"
                                                style={{ padding: '0.4rem 1rem', backgroundColor: 'var(--accent-color)', fontSize: '0.75rem', height: '32px' }}
                                                title="Re-leer y procesar solo las facturas seleccionadas"
                                            >
                                                <Database size={14} />
                                                Reprocesar ({selectedImportRows.size})
                                            </button>
                                        )}
                                        <button
                                            onClick={() => {
                                                setProcessingFilenames(null);
                                                handleImportToDB(false, null, false);
                                            }}
                                            className="btn-primary"
                                            disabled={!importStats || importStats.successful === 0}
                                            style={{ 
                                                padding: '0.4rem 1rem', 
                                                backgroundColor: (!importStats || importStats.successful === 0) ? 'var(--text-muted)' : 'var(--success-color)', 
                                                fontSize: '0.75rem', 
                                                height: '32px',
                                                cursor: (!importStats || importStats.successful === 0) ? 'not-allowed' : 'pointer',
                                                opacity: (!importStats || importStats.successful === 0) ? 0.6 : 1
                                            }}
                                            title={(!importStats || importStats.successful === 0) ? 'No hay facturas listas para cargar' : `Cargar ${importStats?.successful || 0} facturas`}
                                        >
                                            <Database size={14} />
                                            Confirmar Carga
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </FilterBar>
                </div>
            </div>

            {/* Status Message */}
            {
                status !== 'idle' && message && (status !== 'success' || !importStats) && (
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
                )
            }

            {/* Stats and Table */}
            {
                status === 'success' && importStats && (
                    <div style={{ marginBottom: '0.5rem' }}>
                        <div className="data-card" style={{ padding: '0.5rem 1rem', background: '#fff', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '2px' }}>Procesamiento</span>
                                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: '1rem', fontWeight: 800 }}>{importStats.total}</div>
                                                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Total</div>
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: '1rem', fontWeight: 800, color: importStats.duplicates > 0 ? '#f59e0b' : 'inherit' }}>{importStats.duplicates}</div>
                                                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Duplicados</div>
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--success-color)' }}>{importStats.successful}</div>
                                                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{isPreviewMode ? 'OK' : 'Cargadas'}</div>
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: '1rem', fontWeight: 800, color: importStats.inconsistent > 0 ? '#f59e0b' : 'inherit' }}>{importStats.inconsistent}</div>
                                                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Inconsistentes</div>
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: '1rem', fontWeight: 800, color: importStats.errors > 0 ? 'var(--danger-color)' : 'inherit' }}>{importStats.errors}</div>
                                                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Errores</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)' }}></div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 2 }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '2px' }}>Resumen Financiero</span>
                                        <div style={{ display: 'flex', justifyContent: 'flex-start', gap: '2rem', alignItems: 'center' }}>
                                            <div>
                                                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Subtotal</div>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 700 }}><CurrencyValue value={importFinancialSums.subtotal} /></div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Descuentos</div>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 700 }}><CurrencyValue value={-importFinancialSums.descuentos} /></div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Impuestos</div>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 700 }}><CurrencyValue value={importFinancialSums.iva} /></div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Retenciones</div>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 700 }}><CurrencyValue value={-importFinancialSums.retefuente} /></div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Total</div>
                                                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--success-color)' }}><CurrencyValue value={importFinancialSums.total} /></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
            {status === 'success' && processResults && (
                <div className="data-card">
                    <div className="data-card-header" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'flex-start', padding: '1rem 1.25rem' }}>
                        <span className="data-card-title">Detalle de Importación</span>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {[
                                { id: 'all', label: 'Todos', color: 'var(--text-secondary)' },
                                { id: 'success', label: 'OK', color: 'var(--success-color)' },
                                { id: 'duplicate', label: 'Duplicados', color: '#f59e0b' },
                                { id: 'inconsistent', label: 'Inconsistentes', color: '#f59e0b' },
                                { id: 'error', label: 'Errores', color: 'var(--danger-color)' }
                            ].map(f => (
                                <button
                                    key={f.id}
                                    onClick={() => setTableStatusFilter(f.id as any)}
                                    style={{
                                        padding: '0.35rem 0.75rem', fontSize: '0.7rem', fontWeight: 600, borderRadius: '6px', border: '1px solid',
                                        borderColor: tableStatusFilter === f.id ? f.color : 'var(--border-color)',
                                        backgroundColor: tableStatusFilter === f.id ? `${f.color}15` : 'transparent',
                                        color: tableStatusFilter === f.id ? f.color : 'var(--text-muted)',
                                        cursor: 'pointer', transition: 'all 0.2s'
                                    }}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="data-card-content" style={{ padding: 0 }}>
                        <div className="process-log custom-scrollbar" style={{ overflowX: 'auto', height: '661px', overflowY: 'auto', position: 'relative' }}>
                            <table className="data-table" style={{ fontSize: '0.75rem', tableLayout: 'fixed' }}>
                                <thead>
                                    <tr>
                                        <th style={{ width: '40px', padding: '0.4rem 0.75rem', textAlign: 'center', position: 'sticky', top: 0, zIndex: 30, backgroundColor: '#ffffff' }}>
                                            <input type="checkbox" onChange={(e) => {
                                                if (e.target.checked) {
                                                    const nonSuccess = processResults.filter(r => r.status !== 'success').map(r => r.nombre_xml || r.factura || Math.random().toString());
                                                    setSelectedImportRows(new Set(nonSuccess));
                                                } else setSelectedImportRows(new Set());
                                            }} />
                                        </th>
                                        <th className="sortable-header" onClick={() => handleProcessSort('status')} style={{ width: '130px', padding: '0.4rem 0.75rem', textAlign: 'center', position: 'sticky', top: 0, zIndex: 30, backgroundColor: '#ffffff' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>Estado {getProcessSortIcon('status')}</div>
                                        </th>
                                        <th className="sortable-header" onClick={() => handleProcessSort('date')} style={{ width: '85px', padding: '0.4rem 0.75rem', position: 'sticky', top: 0, zIndex: 30, backgroundColor: '#ffffff' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>Fecha {getProcessSortIcon('date')}</div>
                                        </th>
                                        <th className="sortable-header" onClick={() => handleProcessSort('sender')} style={{ width: '250px', padding: '0.4rem 0.75rem', position: 'sticky', top: 0, zIndex: 30, backgroundColor: '#ffffff' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>Emisor {getProcessSortIcon('sender')}</div>
                                        </th>
                                        <th className="sortable-header" onClick={() => handleProcessSort('subject')} style={{ width: '100px', padding: '0.4rem 0.75rem', position: 'sticky', top: 0, zIndex: 30, backgroundColor: '#ffffff' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>Factura {getProcessSortIcon('subject')}</div>
                                        </th>
                                        <th className="sortable-header" onClick={() => handleProcessSort('subtotal')} style={{ width: '110px', padding: '0.4rem 0.75rem', textAlign: 'right', position: 'sticky', top: 0, zIndex: 30, backgroundColor: '#ffffff' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem' }}>SubTotal {getProcessSortIcon('subtotal')}</div>
                                        </th>
                                        <th className="sortable-header" onClick={() => handleProcessSort('descuentos')} style={{ width: '110px', padding: '0.4rem 0.75rem', textAlign: 'right', position: 'sticky', top: 0, zIndex: 30, backgroundColor: '#ffffff' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem' }}>Descuento {getProcessSortIcon('descuentos')}</div>
                                        </th>
                                        <th className="sortable-header" onClick={() => handleProcessSort('impuestos')} style={{ width: '110px', padding: '0.4rem 0.75rem', textAlign: 'right', position: 'sticky', top: 0, zIndex: 30, backgroundColor: '#ffffff' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem' }}>Impuestos {getProcessSortIcon('impuestos')}</div>
                                        </th>
                                        <th className="sortable-header" onClick={() => handleProcessSort('retenciones')} style={{ width: '120px', padding: '0.4rem 0.75rem', textAlign: 'right', position: 'sticky', top: 0, zIndex: 30, backgroundColor: '#ffffff' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem' }}>Retenciones {getProcessSortIcon('retenciones')}</div>
                                        </th>
                                        <th className="sortable-header" onClick={() => handleProcessSort('total')} style={{ width: '110px', padding: '0.4rem 0.75rem', textAlign: 'right', position: 'sticky', top: 0, zIndex: 30, backgroundColor: '#ffffff' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem' }}>Total {getProcessSortIcon('total')}</div>
                                        </th>

                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedProcessResults.filter(res => tableStatusFilter === 'all' || (tableStatusFilter === 'success' && res.status === 'success') || (tableStatusFilter === 'duplicate' && res.status === 'duplicate') || (tableStatusFilter === 'inconsistent' && res.status === 'inconsistent') || (tableStatusFilter === 'error' && (res.status === 'error' || res.status === 'failed'))).map((res: any, idx) => (
                                        <tr key={idx} style={{ backgroundColor: res.status === 'duplicate' ? 'rgba(245, 158, 11, 0.02)' : res.status === 'inconsistent' ? 'rgba(245, 158, 11, 0.04)' : (res.status === 'error' || res.status === 'failed') ? 'rgba(239, 68, 68, 0.04)' : 'transparent' }}>
                                            <td style={{ padding: '0.3rem 0.75rem', textAlign: 'center' }}>
                                                <input type="checkbox" checked={selectedImportRows.has(res.nombre_xml || res.factura)} onChange={(e) => {
                                                    const newSelected = new Set(selectedImportRows);
                                                    if (e.target.checked) newSelected.add(res.nombre_xml || res.factura);
                                                    else newSelected.delete(res.nombre_xml || res.factura);
                                                    setSelectedImportRows(newSelected);
                                                }} />
                                            </td>
                                            <td style={{ padding: '0.3rem 0.75rem', textAlign: 'center' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                                    {res.status === 'success' ? <span className="badge badge-green" style={{ padding: '0.1rem 0.4rem', fontSize: '0.65rem' }}>OK</span> :
                                                        res.status === 'duplicate' ? <span className="badge" style={{ padding: '0.1rem 0.4rem', fontSize: '0.65rem', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>Duplic.</span> :
                                                        res.status === 'inconsistent' ? <span className="badge" style={{ padding: '0.1rem 0.4rem', fontSize: '0.65rem', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>Incon.</span> :
                                                            <span className="badge badge-danger" style={{ padding: '0.1rem 0.4rem', fontSize: '0.65rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>Error</span>}
                                                    <button onClick={() => { setSelectedInvoice(res); setIsDetailModalOpen(true); }} style={{ border: 'none', background: 'var(--accent-light)', color: 'var(--accent-color)', padding: '4px', borderRadius: '4px', cursor: 'pointer' }} title="Ver detalle y análisis de consistencia"><Eye size={14} /></button>
                                                </div>
                                            </td>
                                            <td className="font-mono" style={{ whiteSpace: 'nowrap', padding: '0.3rem 0.75rem', fontSize: '0.7rem' }}>{formatProcessDate(res.date)}</td>
                                            <td style={{ padding: '0.3rem 0.75rem' }}><div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={res.sender}>{res.sender}</div><div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{res.nit}</div></td>
                                            <td style={{ color: 'var(--text-secondary)', padding: '0.3rem 0.75rem', fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{res.subject}</td>
                                            <td style={{ padding: '0.3rem 0.75rem', textAlign: 'right', fontSize: '0.75rem', fontFamily: 'monospace' }}><CurrencyValue value={res.subtotal} /></td>
                                            <td style={{ padding: '0.3rem 0.75rem', textAlign: 'right', fontSize: '0.75rem', fontFamily: 'monospace' }}><CurrencyValue value={-res.descuentos} /></td>
                                            <td style={{ padding: '0.3rem 0.75rem', textAlign: 'right', fontSize: '0.75rem', fontFamily: 'monospace' }}><CurrencyValue value={(res.impuestos || 0) + (res.otros_impuestos || 0)} /></td>
                                            <td style={{ padding: '0.3rem 0.75rem', textAlign: 'right', fontSize: '0.75rem', fontFamily: 'monospace' }}><CurrencyValue value={-(res.retenciones || 0)} /></td>
                                            <td style={{ padding: '0.3rem 0.75rem', textAlign: 'right', fontSize: '0.75rem', fontFamily: 'monospace', fontWeight: 600 }}><CurrencyValue value={res.total} /></td>

                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Detail Modal (Simplified version for brevity, but should include all details) */}
            {/* Detail Modal */}
            <DetailModal
                invoice={selectedInvoice}
                isOpen={isDetailModalOpen}
                onClose={() => setIsDetailModalOpen(false)}
            />

            {/* Tax Classification Modal */}
            <TaxClassificationModal
                isOpen={isTaxModalOpen}
                definitions={missingTaxDefinitions}
                onClose={() => setIsTaxModalOpen(false)}
                onSave={handleSaveTaxRules}
                invoiceContext={invoiceContext}
            />
        </>
    );
}
