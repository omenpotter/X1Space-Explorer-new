// X1 View: transactions per minute (1m tab) and per ten minutes (10m tab), split by type.
//
// What is measured and what is estimated:
//  - Totals, slot counts and (when the RPC reports it) the exact vote count of every window come straight from
//    getRecentPerformanceSamples.
//  - The RPC does not report a per-minute split of the non-vote transactions. That split (transfer, token/program,
//    other) is taken from the mix of the latest confirmed blocks, whose transactions are classified one by one, and
//    applied to the window's non-vote total. It is flagged `estimated` and the UI says so.
//  - If neither is available, no split is produced. Nothing is invented and no default mix is used.

export const VIEWS = {
  '1m': { windows: 10, minutes: 1 },
  '10m': { windows: 5, minutes: 10 },
};

/** Samples needed to fill the largest view. */
export const SAMPLES_NEEDED = 60;

export const CATEGORIES = [
  { key: 'vote', label: 'Vote', hint: 'Validator vote transactions' },
  { key: 'transfer', label: 'Transfer', hint: 'Transactions that call the System program' },
  { key: 'program', label: 'Token/Program', hint: 'Transactions that call any other program' },
  { key: 'other', label: 'Other', hint: 'Transactions with no readable instructions' },
];

const num = (n) => (typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null);

/** Split `total` across `weights` so the integer parts add up to exactly `total` (largest remainder). */
export function apportion(total, weights) {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!(total > 0) || !(sum > 0)) return weights.map(() => 0);
  const raw = weights.map((w) => (w / sum) * total);
  const out = raw.map(Math.floor);
  let left = total - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; left > 0 && k < order.length; k++, left--) out[order[k][1]]++;
  return out;
}

/**
 * Mix of non-vote transactions in the latest confirmed blocks: shares of transfer / program / other.
 * Null when the blocks hold no classified non-vote transactions.
 */
export function blockMix(blocks) {
  let transfer = 0;
  let program = 0;
  let other = 0;
  for (const b of Array.isArray(blocks) ? blocks : []) {
    const total = num(b?.txCount);
    if (total === null) continue;
    const vote = num(b.voteCount) ?? 0;
    const t = num(b.transferCount) ?? 0;
    const p = num(b.programCount) ?? 0;
    const nonVote = Math.max(0, total - vote);
    transfer += t;
    program += p;
    other += Math.max(0, nonVote - t - p);
  }
  const sum = transfer + program + other;
  return sum > 0 ? { transfer, program, other, sum } : null;
}

/** Category counts for one window. `estimated` is true when the non-vote split is inferred from the block mix. */
export function splitWindow(total, nonVote, mix) {
  if (nonVote !== null) {
    const vote = Math.max(0, total - nonVote);
    if (!mix) return { counts: { vote, nonvote: nonVote }, estimated: false, split: false };
    const [transfer, program, other] = apportion(nonVote, [mix.transfer, mix.program, mix.other]);
    return { counts: { vote, transfer, program, other }, estimated: true, split: true };
  }
  if (!mix) return { counts: {}, estimated: false, split: false };
  // Vote count not reported: use the block mix for every category, as the original view did.
  const blockVote = mix.voteShare;
  if (!(blockVote >= 0)) return { counts: {}, estimated: false, split: false };
  const [vote, transfer, program, other] = apportion(total, [blockVote, mix.transfer, mix.program, mix.other]);
  return { counts: { vote, transfer, program, other }, estimated: true, split: true };
}

/** Add the vote share (needed only when samples lack numNonVoteTransactions). */
function fullMix(blocks) {
  const m = blockMix(blocks);
  if (!m) return null;
  let vote = 0;
  for (const b of blocks) vote += num(b?.voteCount) ?? 0;
  return { ...m, voteShare: vote };
}

/**
 * Build the windows for a view from raw RPC samples (newest first).
 *  1m : Now, 1m ago ... 9m ago  (one sample each, up to 10)
 *  10m: 10m ago ... 50m ago     (ten samples each, up to 5, only full windows)
 */
export function buildWindows({ samples, blocks, view }) {
  const cfg = VIEWS[view];
  if (!cfg || !Array.isArray(samples)) return [];
  const mix = fullMix(blocks);
  const out = [];
  for (let i = 0; i < cfg.windows; i++) {
    const chunk = samples.slice(i * cfg.minutes, (i + 1) * cfg.minutes);
    if (chunk.length < cfg.minutes) break;
    let total = 0;
    let slots = 0;
    let nonVote = 0;
    let nonVoteKnown = true;
    let valid = true;
    for (const s of chunk) {
      const t = num(s?.numTransactions);
      const sl = num(s?.numSlots);
      if (t === null || sl === null) { valid = false; break; }
      total += t;
      slots += sl;
      const nv = num(s?.numNonVoteTransactions);
      if (nv === null) nonVoteKnown = false;
      else nonVote += nv;
    }
    if (!valid) break;
    const label = view === '1m' ? (i === 0 ? 'Now' : `${i}m ago`) : `${(i + 1) * 10}m ago`;
    const { counts, estimated, split } = splitWindow(total, nonVoteKnown ? Math.min(nonVote, total) : null, mix);
    out.push({ key: `${view}-${i}`, label, total, slots, counts, estimated, split });
  }
  return out;
}

export const MATRIX_DOTS = 80;

/**
 * Dots for one window, in a fixed order (vote, transfer, program, other). Each category gets a share of the
 * 80 dots proportional to its real count (at least one dot if it is not zero), so the matrix is a true
 * picture of the mix. No randomness. Non-vote transactions with no split are drawn as one neutral group.
 */
export function matrixDots(counts, total = MATRIX_DOTS) {
  const keys = ['vote', 'transfer', 'program', 'other', 'nonvote'].filter((k) => counts?.[k] > 0);
  if (keys.length === 0) return [];
  const sum = keys.reduce((a, k) => a + counts[k], 0);
  let dots = apportion(total, keys.map((k) => counts[k]));
  // A category that exists should be visible: take dots from the largest group.
  for (let i = 0; i < keys.length; i++) {
    if (dots[i] === 0) {
      const big = dots.indexOf(Math.max(...dots));
      dots[big]--;
      dots[i] = 1;
    }
  }
  const out = [];
  keys.forEach((k, i) => { for (let n = 0; n < dots[i]; n++) out.push(k); });
  return sum > 0 ? out : [];
}
