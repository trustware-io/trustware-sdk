export type CurrencyCode = string;

export interface CurrencyMeta {
  code: CurrencyCode;
  symbol: string;
  name: string;
  decimals: number;
}

export const SUPPORTED_CURRENCIES: CurrencyMeta[] = [
  { code: "USD", symbol: "$", name: "US Dollar", decimals: 2 },
  { code: "EUR", symbol: "€", name: "Euro", decimals: 2 },
  { code: "GBP", symbol: "£", name: "British Pound", decimals: 2 },
  { code: "CAD", symbol: "CA$", name: "Canadian Dollar", decimals: 2 },
  { code: "AUD", symbol: "A$", name: "Australian Dollar", decimals: 2 },
  { code: "JPY", symbol: "¥", name: "Japanese Yen", decimals: 0 },
  { code: "CHF", symbol: "Fr", name: "Swiss Franc", decimals: 2 },
  { code: "KRW", symbol: "₩", name: "South Korean Won", decimals: 0 },
  { code: "INR", symbol: "₹", name: "Indian Rupee", decimals: 2 },
  { code: "BRL", symbol: "R$", name: "Brazilian Real", decimals: 2 },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar", decimals: 2 },
  { code: "MXN", symbol: "MX$", name: "Mexican Peso", decimals: 2 },
  { code: "HKD", symbol: "HK$", name: "Hong Kong Dollar", decimals: 2 },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan", decimals: 2 },
  { code: "ZAR", symbol: "R", name: "South African Rand", decimals: 2 },
  { code: "TRY", symbol: "₺", name: "Turkish Lira", decimals: 2 },
  { code: "RUB", symbol: "₽", name: "Russian Ruble", decimals: 2 },
  {
    code: "AED",
    symbol: "د.إ",
    name: "United Arab Emirates Dirham",
    decimals: 2,
  },
  { code: "SAR", symbol: "﷼", name: "Saudi Riyal", decimals: 2 },
  { code: "QAR", symbol: "﷼", name: "Qatari Riyal", decimals: 2 },
  { code: "KWD", symbol: "د.ك", name: "Kuwaiti Dinar", decimals: 3 },
  { code: "OMR", symbol: "ر.ع.", name: "Omani Rial", decimals: 3 },
  { code: "BHD", symbol: "ب.د", name: "Bahraini Dinar", decimals: 3 },
  { code: "JOD", symbol: "د.ا", name: "Jordanian Dinar", decimals: 3 },
  { code: "LYD", symbol: "ل.د", name: "Libyan Dinar", decimals: 3 },
  { code: "TND", symbol: "د.ت", name: "Tunisian Dinar", decimals: 3 },
  { code: "MAD", symbol: "د.م.", name: "Moroccan Dirham", decimals: 2 },
  { code: "EGP", symbol: "£", name: "Egyptian Pound", decimals: 2 },
  { code: "NGN", symbol: "₦", name: "Nigerian Naira", decimals: 2 },
  { code: "GHS", symbol: "₵", name: "Ghanaian Cedi", decimals: 2 },
  { code: "KES", symbol: "KSh", name: "Kenyan Shilling", decimals: 2 },
  { code: "TZS", symbol: "TSh", name: "Tanzanian Shilling", decimals: 2 },
  { code: "UGX", symbol: "USh", name: "Ugandan Shilling", decimals: 2 },
  { code: "RWF", symbol: "FRw", name: "Rwandan Franc", decimals: 2 },
  { code: "MUR", symbol: "Rs", name: "Mauritian Rupee", decimals: 2 },
  { code: "SCR", symbol: "SR", name: "Seychellois Rupee", decimals: 2 },
  { code: "MGA", symbol: "Ar", name: "Malagasy Ariary", decimals: 2 },
  {
    code: "XAF",
    symbol: "FCFA",
    name: "Central African CFA Franc",
    decimals: 2,
  },
  { code: "XOF", symbol: "CFA", name: "West African CFA Franc", decimals: 2 },
  { code: "XPF", symbol: "CFP", name: "CFP Franc", decimals: 2 },
  { code: "XCD", symbol: "EC$", name: "East Caribbean Dollar", decimals: 2 },
  { code: "XDR", symbol: "SDR", name: "Special Drawing Rights", decimals: 2 },
  { code: "XAU", symbol: "Au", name: "Gold (troy ounce)", decimals: 2 },
  { code: "XAG", symbol: "Ag", name: "Silver (troy ounce)", decimals: 2 },
];

const BY_CODE = new Map(SUPPORTED_CURRENCIES.map((c) => [c.code, c]));

export function getCurrencyMeta(code: string): CurrencyMeta {
  return BY_CODE.get(code.toUpperCase()) ?? SUPPORTED_CURRENCIES[0];
}

export function fmtCurrency(
  usdAmount: number,
  code: string,
  rate: number
): string {
  const meta = getCurrencyMeta(code);
  const local = usdAmount * rate;
  return meta.symbol + local.toFixed(meta.decimals);
}
