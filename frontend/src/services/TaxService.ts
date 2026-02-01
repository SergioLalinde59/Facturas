export interface TaxRule {
    code: string;
    name: string;
    type: 'tax' | 'withholding' | 'info';
    operation: 'add' | 'subtract' | 'ignore';
    description: string;
}

export interface TaxRulesResponse {
    status?: string;
    message?: string;
    taxes?: Record<string, TaxRule>;
}

export const TaxService = {
    async getRules(): Promise<Record<string, TaxRule>> {
        const response = await fetch('/api/v1/config/tax-rules');
        if (!response.ok) {
            throw new Error('Error al cargar la configuración de impuestos');
        }
        return response.json();
    },

    async saveRules(rules: TaxRule[]): Promise<TaxRulesResponse> {
        const response = await fetch('/api/v1/config/tax-rules', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ rules })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Error al guardar la configuración');
        }
        return response.json();
    }
};
