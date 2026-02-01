import axios from 'axios';

// Usamos rutas relativas para aprovechar el proxy de Vite
const API_BASE_URL = '/api/tax-rates';


export interface TaxRate {
    id?: number;
    tax_id: number;
    percentage: number;
    name: string;
    description?: string;
}

export const TaxRateService = {
    getTaxRates: async (): Promise<TaxRate[]> => {
        const response = await axios.get(`${API_BASE_URL}/`);
        return response.data;
    },

    getTaxRatesByTax: async (taxId: number): Promise<TaxRate[]> => {
        const response = await axios.get(`${API_BASE_URL}/by-tax/${taxId}`);
        return response.data;
    },

    saveTaxRate: async (taxRate: TaxRate): Promise<TaxRate> => {
        if (taxRate.id) {
            const response = await axios.put(`${API_BASE_URL}/${taxRate.id}`, taxRate);
            return response.data;
        } else {
            const response = await axios.post(`${API_BASE_URL}/`, taxRate);
            return response.data;
        }
    },

    deleteTaxRate: async (id: number): Promise<void> => {
        await axios.delete(`${API_BASE_URL}/${id}`);
    }
};
