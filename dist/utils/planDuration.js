export const BILLING_CYCLES = ['trial', 'monthly', 'quarterly', 'halfyearly', 'yearly', 'biennial'];
const CYCLE_DAYS = {
    trial: 7,
    monthly: 30,
    quarterly: 90,
    halfyearly: 180,
    yearly: 365,
    biennial: 730,
};
export const PLAN_LABELS = {
    trial: '7 Days Trial',
    monthly: '1 Month',
    quarterly: '3 Months',
    halfyearly: '6 Months',
    yearly: '1 Year',
    biennial: '2 Years',
};
export const planDurationDays = (billingCycle) => CYCLE_DAYS[billingCycle] ?? CYCLE_DAYS.monthly;
