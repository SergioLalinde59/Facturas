import { useState } from 'react';

export function useDateFilters(initialQuickFilter: string = 'current-month') {
    const [startDate, setStartDate] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    });
    const [endDate, setEndDate] = useState(() => {
        const now = new Date();
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    });
    const [activeQuickFilter, setActiveQuickFilter] = useState(initialQuickFilter);

    const applyQuickFilter = (type: string) => {
        const today = new Date();
        const now = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        let start = new Date(now);
        let end = new Date(now);

        switch (type) {
            case 'current-month':
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                // End date for current month should be the last day of the month
                end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
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
        setEndDate(formatDate(end));
        setActiveQuickFilter(type);
    };

    return {
        startDate,
        endDate,
        setStartDate,
        setEndDate,
        activeQuickFilter,
        applyQuickFilter
    };
}
