import { useState, useEffect } from 'react';
import {
    Edit2,
    Save,
    X,
    Plus,
    Loader2,
    AlertCircle,
    CheckCircle2
} from 'lucide-react';
import { TaxService } from '../services/TaxService';
import { GroupingService } from '../services/GroupingService';
import type { TaxRule } from '../services/TaxService';
import type { Grouping } from '../services/GroupingService';

interface TaxMasterPageProps {
}

export const TaxMasterPage: React.FC<TaxMasterPageProps> = () => {
    const [rules, setRules] = useState<TaxRule[]>([]);
    const [groupings, setGroupings] = useState<Grouping[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Edit/Create State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentRule, setCurrentRule] = useState<TaxRule>({
        code: '',
        name: '',
        agrupacion_id: undefined,
        description: ''
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        setError('');
        try {
            const [rulesData, groupsData] = await Promise.all([
                TaxService.getRules(),
                GroupingService.getGroupings()
            ]);
            const rulesArray = rulesData.sort((a, b) => a.code.localeCompare(b.code));
            setRules(rulesArray);
            setGroupings(groupsData);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const loadRules = async () => {
        // Keeps loadRules for backward compatibility or individual reloads
        try {
            const data = await TaxService.getRules();
            setRules(data.sort((a, b) => a.code.localeCompare(b.code)));
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleOpenCreate = () => {
        setCurrentRule({
            code: '',
            name: '',
            agrupacion_id: groupings.find(g => g.name === 'Impuestos')?.id || groupings[0]?.id,
            description: ''
        });
        setIsEditing(false);
        setIsModalOpen(true);
        setSuccessMessage('');
        setError('');
    };

    const handleOpenEdit = (rule: TaxRule) => {
        setCurrentRule({ ...rule });
        setIsEditing(true);
        setIsModalOpen(true);
        setSuccessMessage('');
        setError('');
    };

    const handleSave = async () => {
        if (!currentRule.code || !currentRule.name) {
            setError('Código y Nombre son obligatorios');
            return;
        }

        setLoading(true);
        try {
            // Optimistic update or wait for reload?
            // Since API bulk saves, we should probably just send the new/updated rule in the list?
            // The API implementation in backend/src/api/config_api.py accepts a list of rules `TaxRulesRequest(rules: List[TaxRule])`
            // and iterates to `add_rule`. `add_rule` updates the dictionary.
            // So we can just send the SINGLE rule we are saving in a list of 1?
            // Let's check the API implementation again.
            // Yes, it iterates: `for rule in request.rules: service.add_rule(...)`

            await TaxService.saveRules([currentRule]);

            setSuccessMessage(`Impuesto ${isEditing ? 'actualizado' : 'creado'} correctamente`);
            setIsModalOpen(false);
            loadRules(); // Reload to get fresh state
        } catch (err: any) {
            setError(err.message);
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
                        Maestro de Impuestos
                    </h2>
                    <p style={{ color: '#64748b' }}>Configuración de códigos de impuestos y retenciones DIAN</p>
                </div>
                <button
                    className="btn-primary"
                    onClick={handleOpenCreate}
                    style={{ padding: '0.75rem 1.5rem', gap: '0.5rem', display: 'flex', alignItems: 'center' }}
                >
                    <Plus size={18} />
                    <span>Nuevo Impuesto</span>
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
                            <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, color: '#64748b', width: '80px' }}>Código</th>
                            <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, color: '#64748b' }}>Nombre</th>
                            <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, color: '#64748b', width: '150px' }}>Agrupación</th>
                            <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, color: '#64748b', width: '120px' }}>Operación</th>
                            <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, color: '#64748b' }}>Descripción</th>
                            <th style={{ padding: '1rem', textAlign: 'right', fontWeight: 600, color: '#64748b', width: '100px' }}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && rules.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                                    <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 1rem' }} />
                                    Cargando datos...
                                </td>
                            </tr>
                        ) : rules.map((rule) => (
                            <tr key={rule.code} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '1rem', fontFamily: 'monospace', fontWeight: 600 }}>{rule.code}</td>
                                <td style={{ padding: '1rem', fontWeight: 500 }}>{rule.name}</td>
                                <td style={{ padding: '1rem' }}>
                                    <span style={{
                                        padding: '0.25rem 0.75rem',
                                        borderRadius: '999px',
                                        fontSize: '0.875rem',
                                        backgroundColor: '#eff6ff',
                                        color: '#3b82f6',
                                        border: '1px solid #dbeafe'
                                    }}>
                                        {groupings.find(g => g.id === rule.agrupacion_id)?.name || 'Sin Agrupar'}
                                    </span>
                                </td>
                                <td style={{ padding: '1rem' }}>
                                    <span style={{
                                        fontSize: '0.875rem',
                                        color: rule.operation === 'add' ? '#16a34a' : rule.operation === 'subtract' ? '#dc2626' : '#64748b',
                                        fontWeight: 600
                                    }}>
                                        {rule.operation === 'add' ? 'Sumar (+)' : rule.operation === 'subtract' ? 'Restar (-)' : 'Ignorar'}
                                    </span>
                                </td>
                                <td style={{ padding: '1rem', color: '#64748b' }}>{rule.description}</td>
                                <td style={{ padding: '1rem', textAlign: 'right' }}>
                                    <button
                                        onClick={() => handleOpenEdit(rule)}
                                        className="btn-icon"
                                        title="Editar"
                                        style={{ color: '#3b82f6', backgroundColor: '#eff6ff', padding: '0.5rem', borderRadius: '8px' }}
                                    >
                                        <Edit2 size={16} />
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
                                {isEditing ? 'Editar Impuesto' : 'Crear Nuevo Impuesto'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                                <X size={24} color="#94a3b8" />
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: '#475569' }}>Código</label>
                                <input
                                    type="text"
                                    value={currentRule.code}
                                    onChange={(e) => setCurrentRule({ ...currentRule, code: e.target.value })}
                                    disabled={isEditing}
                                    placeholder="Ej: 01, AA, 99"
                                    style={{
                                        width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1',
                                        backgroundColor: isEditing ? '#f1f5f9' : 'white'
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: '#475569' }}>Nombre</label>
                                <input
                                    type="text"
                                    value={currentRule.name}
                                    onChange={(e) => setCurrentRule({ ...currentRule, name: e.target.value })}
                                    placeholder="Nombre corto"
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: '#475569' }}>Agrupación</label>
                                <select
                                    value={currentRule.agrupacion_id || ''}
                                    onChange={(e) => setCurrentRule({ ...currentRule, agrupacion_id: parseInt(e.target.value) })}
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: 'white' }}
                                >
                                    <option value="" disabled>Seleccione una agrupación</option>
                                    {groupings.map(g => (
                                        <option key={g.id} value={g.id}>{g.name} ({g.operation === 'add' ? '+' : g.operation === 'subtract' ? '-' : '0'})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: '#475569' }}>Descripción</label>
                                <textarea
                                    value={currentRule.description}
                                    onChange={(e) => setCurrentRule({ ...currentRule, description: e.target.value })}
                                    placeholder="Descripción detallada..."
                                    rows={3}
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
                                <span>{isEditing ? 'Guardar Cambios' : 'Crear Impuesto'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
