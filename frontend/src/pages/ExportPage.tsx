import { useState } from 'react';
import {
    Download,
    Loader2,
    FileSpreadsheet,
    CheckCircle2,
    AlertCircle
} from 'lucide-react';
import { DirectoryInput } from '../components/molecules';
import { FilterBar } from '../components/organisms';
import { useDateFilters } from '../hooks/useDateFilters';

interface ExportPageProps {
    directory: string;
    onDirectoryChange: (dir: string) => void;
    onBrowse: () => void;
    providers: string[];
}

export function ExportPage({ directory, onDirectoryChange, onBrowse, providers: initialProviders }: ExportPageProps) {
    const {
        startDate,
        endDate,
        setStartDate,
        setEndDate,
        activeQuickFilter,
        applyQuickFilter
    } = useDateFilters('current-month');

    const [provider, setProvider] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');
    const [exportFormats, setExportFormats] = useState({ csv: true, excel: false, pdf: false });

    const handleExportFromDB = async () => {
        const selectedFormats = Object.entries(exportFormats)
            .filter(([_, enabled]) => enabled)
            .map(([format]) => format);

        if (selectedFormats.length === 0) {
            setMessage('Selecciona al menos un formato para exportar');
            setStatus('error');
            return;
        }

        setStatus('loading');
        try {
            const response = await fetch('/api/v1/invoices/export-db', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    output_directory: directory || null,
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
            const errorMsg = err instanceof Error ? err.message : String(err);
            setMessage(errorMsg);
            setStatus('error');
        }
    };

    return (
        <>
            <div className="filter-section">
                <div style={{ marginBottom: '1rem' }}>
                    <DirectoryInput
                        label="Directorio de Trabajo"
                        value={directory}
                        onChange={onDirectoryChange}
                        onBrowse={onBrowse}
                        fullWidth
                    />
                </div>

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

                <div className="filter-row" style={{ marginTop: '1rem' }}>
                    <label className="form-label" style={{ marginRight: '1rem' }}>
                        <FileSpreadsheet size={14} className="form-label-icon" />
                        Exportar a:
                    </label>
                    <div className="checkbox-group">
                        <label className="checkbox-item">
                            <input
                                type="checkbox"
                                checked={exportFormats.csv}
                                onChange={() => setExportFormats(f => ({ ...f, csv: !f.csv }))}
                            />
                            <span>CSV</span>
                        </label>
                        <label className="checkbox-item">
                            <input
                                type="checkbox"
                                checked={exportFormats.excel}
                                onChange={() => setExportFormats(f => ({ ...f, excel: !f.excel }))}
                            />
                            <span>Excel</span>
                        </label>
                        <label className="checkbox-item">
                            <input
                                type="checkbox"
                                checked={exportFormats.pdf}
                                onChange={() => setExportFormats(f => ({ ...f, pdf: !f.pdf }))}
                            />
                            <span>PDF</span>
                        </label>
                    </div>
                </div>

                <div className="filter-row" style={{ marginTop: '0.75rem', justifyContent: 'flex-end' }}>
                    <button
                        onClick={handleExportFromDB}
                        disabled={status === 'loading' || !directory}
                        className="btn-primary"
                        style={{
                            padding: '0.65rem 1.75rem',
                            fontSize: '0.875rem',
                            opacity: status === 'loading' || !directory ? 0.5 : 1,
                            cursor: status === 'loading' || !directory ? 'not-allowed' : 'pointer'
                        }}
                    >
                        {status === 'loading' ? (
                            <Loader2 className="animate-spin" size={18} />
                        ) : (
                            <Download size={18} />
                        )}
                        <span>{status === 'loading' ? 'Procesando...' : 'Generar Reportes'}</span>
                    </button>
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
        </>
    );
}
