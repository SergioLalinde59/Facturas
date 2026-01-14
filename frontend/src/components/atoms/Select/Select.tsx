import React from 'react';
import './Select.css';

export interface SelectOption {
    value: string;
    label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    options: (string | SelectOption)[];
    error?: string;
    fullWidth?: boolean;
}

export const Select: React.FC<SelectProps> = ({
    label,
    options,
    error,
    fullWidth = false,
    className = '',
    id,
    ...props
}) => {
    const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;

    return (
        <div className={`select-container ${fullWidth ? 'select-container--full' : ''} ${error ? 'select-container--error' : ''} ${className}`}>
            {label && <label htmlFor={selectId} className="select__label">{label}</label>}
            <div className="select__wrapper">
                <select id={selectId} className="select" {...props}>
                    {options.map((opt, idx) => {
                        const value = typeof opt === 'string' ? opt : opt.value;
                        const labelStr = typeof opt === 'string' ? opt : opt.label;
                        return <option key={idx} value={value}>{labelStr}</option>;
                    })}
                </select>
            </div>
            {error && <span className="select__error">{error}</span>}
        </div>
    );
};
