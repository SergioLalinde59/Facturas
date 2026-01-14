import React from 'react';
import { } from 'lucide-react';
import { QuickFilterButton } from '../../molecules/QuickFilterButton';
import { DateRangeFilter } from '../../molecules/DateRangeFilter';
import { Select } from '../../atoms/Select';
import './FilterBar.css';

export interface FilterBarProps {
    /** Lista de opciones de filtros rápidos */
    quickFilters: { label: string; active: boolean; onClick: () => void }[];
    /** Props para el rango de fechas */
    dateRange: {
        startDate: string;
        endDate: string;
        onStartDateChange: (val: string) => void;
        onEndDateChange: (val: string) => void;
    };
    /** Props para el selector de proveedor */
    provider: {
        value: string;
        options: string[];
        onChange: (val: string) => void;
    };
}

/**
 * Organism: FilterBar
 * Unifica todos los selectores de filtrado (Rápidos, Fechas, Proveedores)
 */
export const FilterBar: React.FC<FilterBarProps> = ({
    quickFilters,
    dateRange,
    provider
}) => {
    return (
        <div className="filter-bar">
            <div className="filter-bar__quick-filters">
                {quickFilters.map((filter, idx) => (
                    <QuickFilterButton
                        key={idx}
                        label={filter.label}
                        active={filter.active}
                        onClick={filter.onClick}
                    />
                ))}
            </div>

            <div className="filter-bar__main-filters">
                <div className="filter-bar__date-range">
                    <DateRangeFilter
                        startDate={dateRange.startDate}
                        endDate={dateRange.endDate}
                        onStartDateChange={dateRange.onStartDateChange}
                        onEndDateChange={dateRange.onEndDateChange}
                    />
                </div>

                <div className="filter-bar__provider">
                    <Select
                        label="Proveedor"
                        value={provider.value}
                        options={[{ value: '', label: 'Todos los proveedores' }, ...provider.options]}
                        onChange={(e) => provider.onChange(e.target.value)}
                        fullWidth
                    />
                </div>
            </div>
        </div>
    );
};
