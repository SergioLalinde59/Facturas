import React from 'react';
import { StatCard } from '../../molecules/StatCard';
import type { StatCardProps } from '../../molecules/StatCard';
import './StatCardGrid.css';

export interface StatCardGridProps {
    /** Lista de configuraciones para cada StatCard */
    stats: (StatCardProps & { id: string | number })[];
    /** Columnas en escritorio (default 4) */
    columns?: 1 | 2 | 3 | 4 | 5;
}

/**
 * Organism: StatCardGrid
 * Grid receptivo que contiene y organiza múltiples StatCards
 */
export const StatCardGrid: React.FC<StatCardGridProps> = ({
    stats,
    columns = 4
}) => {
    return (
        <div className={`stat-card-grid stat-card-grid--cols-${columns}`}>
            {stats.map((stat) => (
                <StatCard key={stat.id} {...stat} />
            ))}
        </div>
    );
};
