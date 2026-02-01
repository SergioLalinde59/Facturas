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
import { GroupingService } from '../services/GroupingService';
import type { Grouping } from '../services/GroupingService';

export const GroupingsPage: React.FC = () => {
    const [groupings, setGroupings] = useState<Grouping[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Edit/Create State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentGrouping, setCurrentGrouping] = useState<Grouping>({
        name: '',
        operation: 'add'
    });

    useEffect(() => {
        loadGroupings();
    }, []);

    const loadGroupings = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await GroupingService.getGroupings();
            setGroupings(data);
        } catch (err: any) {
            setError(err.message || 'Error al cargar agrupaciones');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenCreate = () => {
        setCurrentGrouping({
            name: '',
            operation: 'add'
        });
        setIsEditing(false);
        setIsModalOpen(true);
        setSuccessMessage('');
        setError('');
    };

    const handleOpenEdit = (grouping: Grouping) => {
        setCurrentGrouping({ ...grouping });
        setIsEditing(true);
        setIsModalOpen(true);
        setSuccessMessage('');
        setError('');
    };

    const handleSave = async () => {
        if (!currentGrouping.name) {
            setError('El nombre es obligatorio');
            return;
        }

        setLoading(true);
        try {
            await GroupingService.saveGrouping(currentGrouping);
            setSuccessMessage(`Agrupación ${isEditing ? 'actualizada' : 'creada'} correctamente`);
            setIsModalOpen(false);
            loadGroupings();
        } catch (err: any) {
            setError(err.message || 'Error al guardar agrupación');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('¿Está seguro de eliminar esta agrupación?')) return;

        setLoading(true);
        try {
            await GroupingService.deleteGrouping(id);
            setSuccessMessage('Agrupación eliminada correctamente');
            loadGroupings();
        } catch (err: any) {
            setError(err.message || 'Error al eliminar agrupación');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>
                        Maestro de Agrupaciones
                    </h2>
                    <p style={{ color: '#64748b' }}>Categorías generales para la consolidación de impuestos y retenciones</p>
                </div>
                <button
                    className="btn-primary"
                    onClick={handleOpenCreate}
                    style={{ padding: '0.75rem 1.5rem', gap: '0.5rem', display: 'flex', alignItems: 'center' }}
                >
                    <Plus size={18} />
                    <span>Nueva Agrupación</span>
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
                            <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, color: '#64748b', width: '80px' }}>ID</th>
                            <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, color: '#64748b' }}>Nombre</th>
                            <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, color: '#64748b', width: '200px' }}>Operación</th>
                            <th style={{ padding: '1rem', textAlign: 'right', fontWeight: 600, color: '#64748b', width: '120px' }}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && groupings.length === 0 ? (
                            <tr>
                                <td colSpan={4} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                                    <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 1rem' }} />
                                    Cargando datos...
                                </td>
                            </tr>
                        ) : groupings.map((g) => (
                            <tr key={g.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '1rem', fontFamily: 'monospace', fontWeight: 600 }}>{g.id}</td>
                                <td style={{ padding: '1rem', fontWeight: 500 }}>{g.name}</td>
                                <td style={{ padding: '1rem' }}>
                                    <span style={{
                                        padding: '0.25rem 0.75rem',
                                        borderRadius: '999px',
                                        fontSize: '0.875rem',
                                        backgroundColor: g.operation === 'add' ? '#dbeafe' : g.operation === 'subtract' ? '#fce7f3' : '#f3f4f6',
                                        color: g.operation === 'add' ? '#1e40af' : g.operation === 'subtract' ? '#be185d' : '#374151'
                                    }}>
                                        {g.operation === 'add' ? 'Sumar (+)' : g.operation === 'subtract' ? 'Restar (-)' : 'Ignorar'}
                                    </span>
                                </td>
                                <td style={{ padding: '1rem', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                    <button
                                        onClick={() => handleOpenEdit(g)}
                                        className="btn-icon"
                                        title="Editar"
                                        style={{ color: '#3b82f6', backgroundColor: '#eff6ff', padding: '0.5rem', borderRadius: '8px' }}
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => g.id && handleDelete(g.id)}
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
                                {isEditing ? 'Editar Agrupación' : 'Crear Nueva Agrupación'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                                <X size={24} color="#94a3b8" />
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: '#475569' }}>Nombre</label>
                                <input
                                    type="text"
                                    value={currentGrouping.name}
                                    onChange={(e) => setCurrentGrouping({ ...currentGrouping, name: e.target.value })}
                                    placeholder="Ej: IVA, Retenciones, etc."
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: '#475569' }}>Operación</label>
                                <select
                                    value={currentGrouping.operation}
                                    onChange={(e) => setCurrentGrouping({ ...currentGrouping, operation: e.target.value as any })}
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: 'white' }}
                                >
                                    <option value="add">Sumar (+)</option>
                                    <option value="subtract">Restar (-)</option>
                                    <option value="ignore">Ignorar</option>
                                </select>
                            </div>

                            <button
                                onClick={handleSave}
                                disabled={loading}
                                className="btn-primary"
                                style={{ marginTop: '1rem', justifyContent: 'center', width: '100%' }}
                            >
                                {loading ? <Loader2 className="animate-spin" /> : <Save size={18} />}
                                <span>{isEditing ? 'Guardar Cambios' : 'Crear Agrupación'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
