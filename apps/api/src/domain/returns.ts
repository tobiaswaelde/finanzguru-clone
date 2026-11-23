/** End-of-day portfolio value and net external contribution in cents. */
export interface ReturnPoint {
  valueCents: number;
  externalFlowCents: number;
}

/** Chain daily subperiod returns; return null when the chain has no valid basis. */
export function twror(points: readonly ReturnPoint[]): number | null {
  let factor = 1;
  let valid = 0;
  for (let index = 1; index < points.length; index++) {
    const prior = points[index - 1];
    const next = points[index];
    if (!prior || !next) return null;
    const residual = next.valueCents - next.externalFlowCents;
    if (prior.valueCents === 0 && residual === 0) continue;
    if (prior.valueCents <= 0 || residual < 0) return null;
    factor *= residual / prior.valueCents;
    valid++;
  }
  return valid > 0 && Number.isFinite(factor) ? factor - 1 : null;
}

/** Dated cash flow from the investor's perspective, with payments negative. */
export interface DatedFlow {
  date: string;
  amountCents: number;
}

/** Solve for the annualized rate of dated flows using the spreadsheet 365-day basis. */
export function xirr(flows: readonly DatedFlow[]): number | null {
  if (!flows.some((flow) => flow.amountCents < 0) || !flows.some((flow) => flow.amountCents > 0)) return null;
  let first = Infinity;
  let scale = 0;
  for (const flow of flows) {
    first = Math.min(first, Date.parse(flow.date));
    scale = Math.max(scale, Math.abs(flow.amountCents));
  }
  const points = flows.map((flow) => ({
    years: (Date.parse(flow.date) - first) / 31_536_000_000,
    amount: flow.amountCents,
  }));
  if (!Number.isFinite(first) || !Number.isFinite(scale) || !points.some((point) => point.years > 0)) return null;
  /** Return the scaled net present value and derivative at a candidate rate. */
  function evaluate(rate: number): { value: number; slope: number } {
    let value = 0;
    let slope = 0;
    for (const { years, amount } of points) {
      const present = amount / scale / (1 + rate) ** years;
      value += present;
      slope -= (years * present) / (1 + rate);
    }
    return { value, slope };
  }
  const tolerance = 1e-10;
  let rate = 0.1;
  for (let iteration = 0; iteration < 64; iteration++) {
    const { value, slope } = evaluate(rate);
    if (Math.abs(value) <= tolerance) return rate;
    const next = rate - value / slope;
    if (!Number.isFinite(next) || next <= -1 || next > 1e6) break;
    rate = next;
  }
  let low = -0.999999;
  let high = 1;
  const lowSign = Math.sign(evaluate(low).value);
  while (high < 1e6 && Math.sign(evaluate(high).value) === lowSign) high *= 2;
  if (Math.sign(evaluate(high).value) === lowSign) return null;
  for (let iteration = 0; iteration < 128; iteration++) {
    rate = (low + high) / 2;
    const value = evaluate(rate).value;
    if (Math.abs(value) <= tolerance || high - low <= tolerance) return rate;
    if (Math.sign(value) === lowSign) low = rate;
    else high = rate;
  }
  return null;
}

/** Convert a nominal return and inflation ratio into a purchasing-power return. */
export function realReturn(nominal: number | null, inflation: number): number | null {
  if (nominal === null || !Number.isFinite(nominal) || !Number.isFinite(inflation) || inflation <= -1) return null;
  return (1 + nominal) / (1 + inflation) - 1;
}
