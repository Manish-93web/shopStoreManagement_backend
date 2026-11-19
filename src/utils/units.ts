// Units of measure a product can be stocked and sold in.
// `decimal` units may be sold in fractions (0.75 kg); the others only in whole numbers.
export const UNITS = [
    { code: 'pcs', label: 'Piece', decimal: false },
    { code: 'box', label: 'Box', decimal: false },
    { code: 'pack', label: 'Pack', decimal: false },
    { code: 'dozen', label: 'Dozen', decimal: false },
    { code: 'pair', label: 'Pair', decimal: false },
    { code: 'set', label: 'Set', decimal: false },
    { code: 'kg', label: 'Kilogram', decimal: true },
    { code: 'g', label: 'Gram', decimal: true },
    { code: 'l', label: 'Litre', decimal: true },
    { code: 'ml', label: 'Millilitre', decimal: true },
    { code: 'm', label: 'Metre', decimal: true },
    { code: 'cm', label: 'Centimetre', decimal: true },
    { code: 'ft', label: 'Foot', decimal: true },
    { code: 'sqft', label: 'Square foot', decimal: true },
] as const;

export const UNIT_CODES: string[] = UNITS.map((u) => u.code);

export const isDecimalUnit = (code?: string): boolean => !!UNITS.find((u) => u.code === code)?.decimal;
