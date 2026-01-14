import React from 'react';
import { Calendar } from 'lucide-react';
import { Input } from '../../atoms/Input';
import './DateRangeFilter.css';

export interface DateRangeFilterProps {
    /** Fecha inicial */
    startDate: string;
    /** Fecha final */
    endDate: string;
    /** Callback cuando cambia la fecha inicial */
    onStartDateChange: (value: string) => void;
    /** Callback cuando cambia la fecha final */
    onEndDateChange: (value: string) => void;
    /** Ancho completo opcional */
    fullWidth?: boolean;
}

/**
 * Molecule: DateRangeFilter
 * Componente que agrupa inputs de fecha para rangos "Desde/Hasta"
 */
export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
    startDate,
    endDate,
    onStartDateChange,
    onEndDateChange,
    fullWidth = false
}) => {
    return (
        <div className={`date-range-filter ${fullWidth ? 'date-range-filter--full' : ''}`}>
            <Input
                label="Desde"
                type="date"
                value={startDate}
                onChange={(e) => onStartDateChange(e.target.value)}
                icon={<Calendar size={14} />}
                size="md"
                fullWidth
            />
            <Input
                label="Hasta"
                type="date"
                value={endDate}
                onChange={(e) => onEndDateChange(e.target.value)}
                icon={<Calendar size={14} />}
                size="md"
                fullWidth
            />
        </div>
    );
};
