import React, { useState, useEffect } from 'react';
import {
    Edit2,
    Save,
    X,
    Plus,
    Loader2,
    AlertCircle,
    CheckCircle2,
    Trash2
} from 'lucide-react';
import { TaxRateService } from '../services/TaxRateService';
import type { TaxRate } from '../services/TaxRateService';
import { TaxService } from '../services/TaxService';
import type { TaxRule } from '../services/TaxService';

export const TaxRatesPage: React.FC = () => {
    const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
    const [taxes, setTaxes] = useState<TaxRule[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Edit/Create State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentTaxRate, setCurrentTaxRate] = useState<TaxRate>({
        tax_id: 0,
        percentage: 0,
        name: '',
        description: ''
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        setError('');
        try {
            const [ratesData, taxesData] = await Promise.all([
                TaxRateService.getTaxRates(),
                TaxService.getRules() // Now returns TaxRule[]
            ]);

            setTaxRates(ratesData);
            setTaxes(taxesData);
        } catch (err: any) {
            setError(err.message || 'Error al cargar datos');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenCreate = () => {
        setCurrentTaxRate({
            tax_id: taxes.length > 0 ? taxes[0].id || 0 : 0,
            percentage: 0,
            name: '',
            description: ''
        });
        setIsEditing(false);
        setIsModalOpen(true);
        setSuccessMessage('');
        setError('');
    };

    const handleOpenEdit = (rate: TaxRate) => {
        setCurrentTaxRate({ ...rate });
        setIsEditing(true);
        setIsModalOpen(true);
        setSuccessMessage('');
        setError('');
    };

    const handleSave = async () => {
        if (!currentTaxRate.tax_id || !currentTaxRate.name) {
            setError('Impuesto y Nombre son obligatorios');
            return;
        }

        setLoading(true);
        try {
            await TaxRateService.saveTaxRate(currentTaxRate);
            setSuccessMessage(`Tarifa ${isEditing ? 'actualizada' : 'creada'} correctamente`);
            setIsModalOpen(false);
            loadData();
        } catch (err: any) {
            setError(err.message || 'Error al guardar tarifa');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('¿Está seguro de eliminar esta tarifa?')) return;

        setLoading(true);
        try {
            await TaxRateService.deleteTaxRate(id);
            setSuccessMessage('Tarifa eliminada correctamente');
            loadData();
        } catch (err: any) {
            setError(err.message || 'Error al eliminar tarifa');
        } finally {
            setLoading(false);
        }
    };

    const getTaxName = (taxId: number) => {
        const tax = taxes.find(t => t.id === taxId);
        return tax ? `${tax.name} (${tax.code})` : 'Desconocido';
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>
                        Maestro de Tarifas
                    </h2>
                    <p style={{ color: '#64748b' }}>Configuración de porcentajes específicos por cada tipo de impuesto</p>
                </div>
                <button
                    className="btn-primary"
                    onClick={handleOpenCreate}
                    style={{ padding: '0.75rem 1.5rem', gap: '0.5rem', display: 'flex', alignItems: 'center' }}
                >
                    <Plus size={18} />
                    <span>Nueva Tarifa</span>
                </button>
            </div>

            {/* Status Messages */}
            {error && (
                <div style={{ padding: '1rem', backgroundColor: '#fee2e2', color: '#ef4444', borderRadius: '8px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertCircle size={20} />
                    {error}
                </div>
            )}
            {successMessage && (
                <div style={{ padding: '1rem', backgroundColor: '#dcfce7', color: '#16a34a', borderRadius: '8px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CheckCircle2 size={20} />
                    {successMessage}
                </div>
            )}

            {/* Table */}
            <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <tr>
                            <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, color: '#64748b' }}>Impuesto</th>
                            <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, color: '#64748b' }}>Nombre</th>
                            <th style={{ padding: '1rem', textAlign: 'center', fontWeight: 600, color: '#64748b', width: '120px' }}>Porcentaje</th>
                            <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, color: '#64748b' }}>Descripción</th>
                            <th style={{ padding: '1rem', textAlign: 'right', fontWeight: 600, color: '#64748b', width: '120px' }}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && taxRates.length === 0 ? (
                            <tr>
                                <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                                    <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 1rem' }} />
                                    Cargando datos...
                                </td>
                            </tr>
                        ) : taxRates.map((r) => (
                            <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '1rem', fontWeight: 500 }}>{getTaxName(r.tax_id)}</td>
                                <td style={{ padding: '1rem' }}>{r.name}</td>
                                <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 600, color: '#0f172a' }}>
                                    {(r.percentage * 100).toFixed(2)}%
                                </td>
                                <td style={{ padding: '1rem', color: '#64748b', fontSize: '0.875rem' }}>{r.description}</td>
                                <td style={{ padding: '1rem', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                    <button
                                        onClick={() => handleOpenEdit(r)}
                                        className="btn-icon"
                                        title="Editar"
                                        style={{ color: '#3b82f6', backgroundColor: '#eff6ff', padding: '0.5rem', borderRadius: '8px' }}
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => r.id && handleDelete(r.id)}
                                        className="btn-icon"
                                        title="Eliminar"
                                        style={{ color: '#ef4444', backgroundColor: '#fef2f2', padding: '0.5rem', borderRadius: '8px' }}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50
                }}>
                    <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '500px', maxWidth: '90%', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
                                {isEditing ? 'Editar Tarifa' : 'Crear Nueva Tarifa'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                                <X size={24} color="#94a3b8" />
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: '#475569' }}>Impuesto</label>
                                <select
                                    value={currentTaxRate.tax_id}
                                    onChange={(e) => setCurrentTaxRate({ ...currentTaxRate, tax_id: parseInt(e.target.value) })}
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: 'white' }}
                                >
                                    <option value={0}>Seleccione un impuesto...</option>
                                    {taxes.map(t => (
                                        <option key={t.code} value={t.id}>{t.name} ({t.code})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: '#475569' }}>Nombre de la Tarifa</label>
                                <input
                                    type="text"
                                    value={currentTaxRate.name}
                                    onChange={(e) => setCurrentTaxRate({ ...currentTaxRate, name: e.target.value })}
                                    placeholder="Ej: IVA 19%, ReteFuente 2.5%"
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: '#475569' }}>Porcentaje (Decimales p.e. 0.19)</label>
                                <input
                                    type="number"
                                    step="0.000001"
                                    value={currentTaxRate.percentage}
                                    onChange={(e) => setCurrentTaxRate({ ...currentTaxRate, percentage: parseFloat(e.target.value) })}
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                                />
                                <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                                    Valor actual: {(currentTaxRate.percentage * 100).toFixed(4)}%
                                </p>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: '#475569' }}>Descripción</label>
                                <textarea
                                    value={currentTaxRate.description}
                                    onChange={(e) => setCurrentTaxRate({ ...currentTaxRate, description: e.target.value })}
                                    placeholder="Notas adicionales..."
                                    rows={2}
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontFamily: 'inherit' }}
                                />
                            </div>

                            <button
                                onClick={handleSave}
                                disabled={loading}
                                className="btn-primary"
                                style={{ marginTop: '1rem', justifyContent: 'center', width: '100%' }}
                            >
                                {loading ? <Loader2 className="animate-spin" /> : <Save size={18} />}
                                <span>{isEditing ? 'Guardar Cambios' : 'Crear Tarifa'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
