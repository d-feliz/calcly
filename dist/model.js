export const YEAR=2026;
export const RATE=.315;
export const brackets=[
[670,653.59,718.94,'≤ 670','Reducido 1'],[900,718.95,900,'> 670 – 900','Reducido 2'],[1166.7,849.67,1166.7,'> 900 – < 1.166,70','Reducido 3'],[1300,950.98,1300,'1.166,70 – 1.300','General 1'],[1500,960.78,1500,'> 1.300 – 1.500','General 2'],[1700,960.78,1700,'> 1.500 – 1.700','General 3'],[1850,1143.79,1850,'> 1.700 – 1.850','General 4'],[2030,1209.15,2030,'> 1.850 – 2.030','General 5'],[2330,1274.51,2330,'> 2.030 – 2.330','General 6'],[2760,1356.21,2760,'> 2.330 – 2.760','General 7'],[3190,1437.91,3190,'> 2.760 – 3.190','General 8'],[3620,1519.61,3620,'> 3.190 – 3.620','General 9'],[4050,1601.31,4050,'> 3.620 – 4.050','General 10'],[6000,1732.03,5101.2,'> 4.050 – 6.000','General 11'],[Infinity,1928.1,5101.2,'> 6.000','General 12']];
export const round=n=>Math.round((n+Number.EPSILON)*100)/100;
export function calculate(state) {
  const expenses = round(state.expenses.reduce((sum, expense) => sum + expense.amount, 0));
  // Monthly expenses are also the representative expense estimate for the average.
  // Changing the actual month's invoices never changes the contribution bracket.
  const returns = round(Math.max(0, state.averageIncome - expenses) * .93);
  const index = brackets.findIndex((b, i) => i === 2 ? returns < b[0] : returns <= b[0]);
  const bracket = brackets[index];
  const base = round(Math.min(bracket[2], Math.max(bracket[1], state.base ?? bracket[1])));
  const fee = round(base * RATE);
  const profit = round(state.income - expenses - fee);
  const tax = round(Math.max(0, profit) * state.tax / 100);
  const contributions = round(fee + tax);
  return { expenses, returns, index, bracket, base, fee, profit, tax,
    contributions, contributionPercent: state.income > 0 ? contributions / state.income * 100 : null,
    net: round(profit - tax) };
}

export function validate(value) {
  const valid = n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 10000000;
  if (!value || ![1, 2].includes(value.version) || value.year !== YEAR ||
      !valid(value.income) || (value.version === 2 && !valid(value.averageIncome)) ||
      !valid(value.tax) || value.tax > 60 || !Array.isArray(value.expenses) ||
      value.expenses.length > 200 || !value.expenses.every(e => e && typeof e.name === 'string' &&
      e.name.trim().length > 0 && e.name.length <= 80 && valid(e.amount)) ||
      (value.base !== null && !valid(value.base))) {
    throw Error('El archivo no es un progreso válido de Calcly 2026.');
  }
  // Old JSON files and existing local saves used one income for both calculations.
  const clean = { version: 2, year: YEAR, income: round(value.income),
    averageIncome: round(value.version === 1 ? value.income : value.averageIncome),
    tax: value.tax, base: value.base === null ? null : round(value.base),
    expenses: value.expenses.map(e => ({ name: e.name.trim(), amount: round(e.amount) })) };
  const result = calculate(clean);
  if (clean.base !== null && (clean.base < result.bracket[1] || clean.base > result.bracket[2])) {
    throw Error('La base guardada está fuera de su tramo.');
  }
  return clean;
}
