import { useState, useMemo } from 'react';
import {
    Mail,
    History,
    CheckCircle2,
    Trash2,
    FileCheck,
    Loader2,
    X,
    Play
} from 'lucide-react';

import type { ProcessingStats, ProcessSortColumn, SortDirection } from '../types';
import { renderStatusBadge, formatProcessDate } from '../utils/uiUtils';

interface ExtractionPageProps {
}

export function ExtractionPage({ }: ExtractionPageProps) {
    const [maxEmails, setMaxEmails] = useState(50);
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');
    const [stats, setStats] = useState<ProcessingStats | null>(null);
    const [processResults, setProcessResults] = useState<any[]>([]);
    const [isExtractModalOpen, setIsExtractModalOpen] = useState(false);

    // Sorting state for extraction process log
    const [processSortColumn, setProcessSortColumn] = useState<ProcessSortColumn>('date');
    const [processSortDirection, setProcessSortDirection] = useState<SortDirection>('desc');

    const sortedProcessResults = useMemo(() => {
        if (!processResults.length) return [];

        return [...processResults].sort((a, b) => {
            let comparison = 0;
            switch (processSortColumn) {
                case 'date':
                    comparison = (a.date || '').localeCompare(b.date || '');
                    break;
                case 'sender':
                    comparison = (a.sender || '').localeCompare(b.sender || '');
                    break;
                case 'nit':
                    comparison = (a.nit || '').localeCompare(b.nit || '');
                    break;
                case 'subject':
                    comparison = (a.subject || '').localeCompare(b.subject || '');
                    break;
                case 'subtotal': comparison = (a.subtotal || 0) - (b.subtotal || 0); break;
                case 'descuentos': comparison = (a.descuentos || 0) - (b.descuentos || 0); break;
                case 'total': comparison = (a.total || 0) - (b.total || 0); break;
                case 'nombre_xml':
                    comparison = (a.nombre_xml || '').localeCompare(b.nombre_xml || '');
                    break;
                case 'impuestos': comparison = (a.impuestos || 0) - (b.impuestos || 0); break;
                case 'count':
                    comparison = (a.attachments?.length || 0) - (b.attachments?.length || 0);
                    break;
                case 'status':
                    comparison = (a.status || '').localeCompare(b.status || '');
                    break;
                case 'retenciones': comparison = (a.retenciones || 0) - (b.retenciones || 0); break;
            }
            return processSortDirection === 'asc' ? comparison : -comparison;
        });
    }, [processResults, processSortColumn, processSortDirection]);

    const handleSort = (column: ProcessSortColumn) => {
        if (column === processSortColumn) {
            setProcessSortDirection(processSortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setProcessSortColumn(column);
            setProcessSortDirection('asc');
        }
    };

    const handleProcess = async () => {
        setStatus('loading');
        setIsExtractModalOpen(true);
        setProcessResults([]);
        setStats({
            total_scanned: 0,
            successful: 0,
            trashed: 0,
            errors: 0,
            files_saved: 0,
            subtotal_sum: 0,
            iva_sum: 0,
            total_sum: 0
        });
        setMessage('Iniciando conexión con Gmail...');

        try {
            console.log('Iniciando proceso con maxEmails:', maxEmails);
            const url = new URL('/api/v1/invoices/process-stream', window.location.origin);
            url.searchParams.append('max_emails', (maxEmails || 50).toString());

            const response = await fetch(url.toString());
            if (!response.ok) throw new Error('Error al conectar con el servidor');

            const reader = response.body?.getReader();
            if (!reader) throw new Error('No se pudo establecer el canal de datos');

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const event = JSON.parse(line.substring(6));

                            if (event.type === 'start') {
                                setMessage(`Escaneando ${event.total} correos...`);
                            } else if (event.type === 'item') {
                                setStats(event.stats);
                                setProcessResults(prev => [event.data, ...prev]);
                                setMessage(`Procesando: ${event.data.subject}`);
                            } else if (event.type === 'complete') {
                                setStats(event.stats);
                                setStatus('success');
                                setMessage(`Extracción completada. ${event.stats.successful} facturas guardadas.`);
                            } else if (event.type === 'error') {
                                throw new Error(event.message);
                            }
                        } catch (e) {
                            console.error('Error parseando evento:', e);
                        }
                    }
                }
            }
        } catch (err: any) {
            setMessage(err.message);
            setStatus('error');
        }
    };

    return (
        <>
            <div className="filter-section">
                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center' }}>
                    <div className="form-group" style={{ width: '320px', textAlign: 'center' }}>
                        <label className="form-label" style={{ justifyContent: 'center' }}>
                            <History size={14} className="form-label-icon" />
                            Cantidad de correos a procesar
                        </label>
                        <input
                            type="number"
                            min="1"
                            className="form-input"
                            style={{ textAlign: 'center', fontSize: '1.1rem', fontWeight: 600 }}
                            value={maxEmails === 0 ? '' : maxEmails}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val === '') {
                                    setMaxEmails(0);
                                } else {
                                    const parsed = parseInt(val);
                                    if (!isNaN(parsed)) setMaxEmails(parsed);
                                }
                            }}
                        />
                    </div>
                </div>

                <div className="filter-row" style={{ marginTop: '1.5rem', justifyContent: 'center' }}>
                    <button
                        onClick={handleProcess}
                        disabled={status === 'loading'}
                        className="btn-primary"
                        style={{
                            padding: '0.65rem 1.75rem',
                            fontSize: '0.875rem',
                            opacity: status === 'loading' ? 0.5 : 1,
                            cursor: status === 'loading' ? 'not-allowed' : 'pointer'
                        }}
                    >
                        {status === 'loading' ? (
                            <Loader2 className="animate-spin" size={18} />
                        ) : (
                            <Play size={18} />
                        )}
                        <span>{status === 'loading' ? 'Procesando...' : 'Iniciar Extracción'}</span>
                    </button>
                </div>
            </div>

            {stats && (status === 'success' || (status === 'loading' && stats.total_scanned > 0)) && (
                <div className="summary-cards" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginTop: '2rem' }}>
                    <div className="summary-card">
                        <div className="summary-card-content">
                            <span className="summary-card-label">Correos Escaneados</span>
                            <span className="summary-card-value neutral">{stats.total_scanned}</span>
                        </div>
                        <div className="summary-card-icon neutral"><Mail size={20} /></div>
                    </div>
                    <div className="summary-card">
                        <div className="summary-card-content">
                            <span className="summary-card-label">Exitosos</span>
                            <span className="summary-card-value positive">{stats.successful}</span>
                        </div>
                        <div className="summary-card-icon positive"><CheckCircle2 size={20} /></div>
                    </div>
                    <div className="summary-card">
                        <div className="summary-card-content">
                            <span className="summary-card-label">En Papelera</span>
                            <span className="summary-card-value negative">{stats.trashed}</span>
                        </div>
                        <div className="summary-card-icon negative"><Trash2 size={20} /></div>
                    </div>
                    <div className="summary-card">
                        <div className="summary-card-content">
                            <span className="summary-card-label">Archivos Guardados</span>
                            <span className="summary-card-value positive">{stats.files_saved}</span>
                        </div>
                        <div className="summary-card-icon positive"><FileCheck size={20} /></div>
                    </div>
                </div>
            )}

            {isExtractModalOpen && (
                <div className="modal-overlay" style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(4px)',
                    zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div className="modal-content" style={{
                        backgroundColor: '#ffffff', borderRadius: '16px',
                        width: '1080px', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden'
                    }}>
                        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent-color)', width: 40, height: 40, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {status === 'loading' ? <Loader2 size={24} className="animate-spin" /> : <CheckCircle2 size={24} />}
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: '#0f172a' }}>
                                        {status === 'loading' ? 'Procesando Facturas' : 'Extracción Finalizada'}
                                    </h3>
                                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                                        {message}
                                    </p>
                                </div>
                            </div>
                            {status !== 'loading' && (
                                <button
                                    onClick={() => setIsExtractModalOpen(false)}
                                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}
                                >
                                    <X size={24} />
                                </button>
                            )}
                        </div>

                        <div className="custom-scrollbar" style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
                            {stats && stats.total_scanned > 0 && (
                                <div style={{
                                    padding: '1.5rem',
                                    borderRadius: '12px',
                                    background: 'rgba(37, 99, 235, 0.03)',
                                    border: '1px solid rgba(37, 99, 235, 0.1)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    marginBottom: '1.5rem'
                                }}>
                                    <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--accent-color)', fontFamily: 'monospace', lineHeight: 1 }}>
                                        {(stats.successful + stats.trashed + stats.errors)} <span style={{ color: 'var(--text-muted)', fontSize: '1.25rem', fontWeight: 400 }}>/</span> {stats.total_scanned}
                                    </div>
                                    <div style={{ width: '100%', maxWidth: '100%', height: '8px', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '4px', marginTop: '0.5rem', overflow: 'hidden' }}>
                                        <div style={{
                                            height: '100%',
                                            width: `${Math.min(100, ((stats.successful + stats.trashed + stats.errors) / stats.total_scanned) * 100)}%`,
                                            backgroundColor: 'var(--accent-color)',
                                            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                                        }}></div>
                                    </div>
                                </div>
                            )}

                            {stats && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                                    <div style={{ padding: '1rem', borderRadius: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Exitosos</div>
                                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--success-color)' }}>{stats.successful}</div>
                                    </div>
                                    <div style={{ padding: '1rem', borderRadius: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Omitidos</div>
                                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#94a3b8' }}>{stats.trashed}</div>
                                    </div>
                                    <div style={{ padding: '1rem', borderRadius: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Errores</div>
                                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--danger-color)' }}>{stats.errors}</div>
                                    </div>
                                    <div style={{ padding: '1rem', borderRadius: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Archivos</div>
                                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-color)' }}>{stats.files_saved}</div>
                                    </div>
                                </div>
                            )}

                            <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                                <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                                    <table className="data-table" style={{ fontSize: '0.75rem' }}>
                                        <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                                            <tr>
                                                <th onClick={() => handleSort('date')} style={{ cursor: 'pointer' }}>Fecha {processSortColumn === 'date' && (processSortDirection === 'asc' ? '↑' : '↓')}</th>
                                                <th onClick={() => handleSort('sender')} style={{ cursor: 'pointer' }}>Remitente {processSortColumn === 'sender' && (processSortDirection === 'asc' ? '↑' : '↓')}</th>
                                                <th onClick={() => handleSort('subject')} style={{ cursor: 'pointer' }}>Asunto {processSortColumn === 'subject' && (processSortDirection === 'asc' ? '↑' : '↓')}</th>
                                                <th style={{ textAlign: 'center' }}>Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sortedProcessResults.map((res: any, idx: number) => (
                                                <tr key={idx}>
                                                    <td style={{ whiteSpace: 'nowrap' }}>{formatProcessDate(res.date)}</td>
                                                    <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '250px' }}>{res.sender?.split('<')[0]}</td>
                                                    <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '500px' }}>{res.subject}</td>
                                                    <td style={{ textAlign: 'center' }}>{renderStatusBadge(res.status)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setIsExtractModalOpen(false)}
                                className="btn-primary"
                                disabled={status === 'loading'}
                                style={{ padding: '0.5rem 2rem' }}
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
