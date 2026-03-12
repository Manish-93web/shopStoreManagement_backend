import axios from 'axios';
import Currency from '../models/Currency.js';

export const currencyService = {
    /**
     * Fetch latest rates from an external API (Example: ExchangeRate-API)
     * This is a placeholder. In production, you'd use a real API key.
     */
    updateExchangeRates: async (storeId: string) => {
        const baseCurrency = await Currency.findOne({ storeId, isBase: true });
        if (!baseCurrency) return;

        // Example API call
        // const response = await axios.get(`https://api.exchangerate-api.com/v4/latest/${baseCurrency.code}`);
        // const rates = response.data.rates;

        // Mock update for demonstration
        const currencies = await Currency.find({ storeId, isBase: false });
        for (const currency of currencies) {
            // currency.exchangeRate = rates[currency.code];
            // await currency.save();
        }
    },

    convert: (amount: number, fromRate: number, toRate: number) => {
        return (amount / fromRate) * toRate;
    }
};
