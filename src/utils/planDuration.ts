// How long a plan lasts, by billing cycle. `trial` is the 7-day free trial.
export type BillingCycle = 'trial' | 'monthly' | 'quarterly' | 'halfyearly' | 'yearly' | 'biennial';

export const BILLING_CYCLES: BillingCycle[] = ['trial', 'monthly', 'quarterly', 'halfyearly', 'yearly', 'biennial'];

const CYCLE_DAYS: Record<BillingCycle, number> = {
    trial: 7,
    monthly: 30,
    quarterly: 90,
    halfyearly: 180,
    yearly: 365,
    biennial: 730,
};

export const PLAN_LABELS: Record<BillingCycle, string> = {
    trial: '7 Days Trial',
    monthly: '1 Month',
    quarterly: '3 Months',
    halfyearly: '6 Months',
    yearly: '1 Year',
    biennial: '2 Years',
};

export const planDurationDays = (billingCycle: string | undefined): number =>
    CYCLE_DAYS[billingCycle as BillingCycle] ?? CYCLE_DAYS.monthly;
