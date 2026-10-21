export interface Money {
  readonly amount: number;
  readonly currency: string;
}
export interface CurrencyUnitContract {
  readonly currency: string;
  readonly providerUnitsPerMajor: number;
  readonly status: "BUDGET_WRITE_VERIFIED" | "BUDGET_WRITE_UNVERIFIED" | "BUDGET_WRITE_BLOCKED";
  readonly evidenceId?: string;
}
/** No production currency is claimed verified by arithmetic tests alone. */
export const CURRENCY_READINESS: Readonly<Record<string, CurrencyUnitContract>> = Object.freeze({
  IDR: { currency: "IDR", providerUnitsPerMajor: 100, status: "BUDGET_WRITE_UNVERIFIED" },
  USD: { currency: "USD", providerUnitsPerMajor: 100, status: "BUDGET_WRITE_UNVERIFIED" },
});
export function toProviderMoney(money: Money, contract: CurrencyUnitContract): string {
  if (contract.status !== "BUDGET_WRITE_VERIFIED" || !contract.evidenceId)
    throw Error("BUDGET_WRITE_UNVERIFIED");
  if (
    money.currency !== contract.currency ||
    !Number.isFinite(money.amount) ||
    money.amount < 0 ||
    !Number.isSafeInteger(contract.providerUnitsPerMajor) ||
    contract.providerUnitsPerMajor <= 0
  )
    throw Error("Invalid money contract");
  const units = money.amount * contract.providerUnitsPerMajor;
  if (!Number.isSafeInteger(Math.round(units)) || Math.abs(units - Math.round(units)) > 0.000001)
    throw Error("Amount cannot be represented safely");
  return String(Math.round(units));
}
export function fromProviderMoney(units: string, contract: CurrencyUnitContract): Money {
  if (
    !/^\d+$/.test(units) ||
    !Number.isSafeInteger(Number(units)) ||
    contract.providerUnitsPerMajor <= 0
  )
    throw Error("Invalid provider amount");
  return { amount: Number(units) / contract.providerUnitsPerMajor, currency: contract.currency };
}
