import { Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import PageHeader from '@/components/shell/PageHeader';
import { Panel } from '@/components/ds/Primitives';
import { createPageUrl } from '@/utils';

// Static, crawlable guide. Every X1-specific figure is either from docs.x1.xyz or was read from
// X1 mainnet RPC on the date shown; nothing here depends on live data or a wallet.
const UPDATED = '2026-11-23';
const RPC_CHECKED = '2026-11-20';

const ext = (href, children) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="text-brand underline underline-offset-2 hover:text-brand-strong">{children}</a>
);
const page = (name, children) => (
  <Link to={createPageUrl(name)} className="text-brand underline underline-offset-2 hover:text-brand-strong">{children}</Link>
);
const Code = ({ children }) => <code className="mono rounded border border-line bg-surface-2 px-1.5 py-0.5 text-[12px] text-ink-soft">{children}</code>;

function Section({ id, title, children }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24 pt-8 first-of-type:pt-0">
      <h2 id={`${id}-h`} className="mb-3 font-display text-xl font-semibold text-ink">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-ink-soft [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1">{children}</div>
    </section>
  );
}

const TOC = [
  ['what-is-x1', 'What is the X1 blockchain?'],
  ['blocks', 'Reading X1 blocks'],
  ['transactions', 'Understanding X1 transactions'],
  ['validators', 'Validators, stake and leader slots'],
  ['tokens', 'Verifying an X1 token (SPL and Token-2022)'],
  ['pools', 'Liquidity pools'],
  ['rpc', 'X1 RPC and developer access'],
  ['names', 'X1 is not X1 EcoChain or BlockDAG X1'],
  ['sources', 'Sources'],
];

export default function Learn() {
  return (
    <>
      <PageHeader
        icon={BookOpen}
        title="How to use an X1 blockchain explorer"
        description="A practical guide to X1 mainnet data: blocks, transactions, validators, tokens and liquidity pools — and how to verify each one yourself."
        meta={<p className="text-xs text-ink-faint">By ARKBS Labs · Updated <time dateTime={UPDATED}>23 November 2026</time></p>}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <Panel bodyClassName="p-5 sm:p-7" as="article" aria-label="X1 explorer guide">
          <p className="mb-6 rounded-lg border border-brand/25 bg-brand/5 p-4 text-sm text-ink">
            <strong>In short:</strong> X1 Space Explorer helps you look up blocks, transactions, addresses, validators and token mints on X1 mainnet.
            It reads blockchain records from X1 RPC and on-chain accounts and uses XDEX data for supported liquidity-pool views.
            Use the {page('ApiDocs', 'API Documentation')} to check individual records with public RPC methods.
          </p>

          <Section id="what-is-x1" title="What is the X1 blockchain?">
            <p>
              X1 describes itself as a high-performance, high-throughput monolithic layer-1 that is fully compatible with the
              <strong> Solana Virtual Machine (SVM)</strong>, so Solana programs, wallets, SDKs and the <Code>solana</Code> CLI work against it.
              X1 mainnet launched on 6 October 2025. Its native token is <strong>XNT</strong>, used for fees and delegated proof-of-stake.
            </p>
            <p>X1 changes several network parameters relative to Solana:</p>
            <ul>
              <li><strong>Zero-cost votes</strong> — validators do not pay fees to vote, lowering the cost of running a validator.</li>
              <li><strong>Dynamic base fees</strong> — base fees reflect current demand for block space rather than being fixed.</li>
              <li><strong>Epochs of 216,000 slots</strong> (from <Code>getEpochSchedule</Code>), half of Solana mainnet&apos;s 432,000.</li>
              <li><strong>Inflation</strong> documented as starting at 8% and decreasing 15% per year toward a long-term 1.5%.</li>
            </ul>
            <p>Live chain figures — current slot, epoch progress, TPS and block production — are on {page('NetworkHealth', 'Network Health')}.</p>
          </Section>

          <Section id="blocks" title="Reading X1 blocks">
            <p>
              Time on X1 is divided into <strong>slots</strong>. In each slot one validator, the <em>leader</em>, may produce a block. A slot without a block
              is <em>skipped</em>. Slot numbers track scheduled positions, while block height counts blocks that were produced. The {page('Blocks', 'Blocks')} page lists recent blocks with their
              slot, time, transaction count, fees and leader.
            </p>
            <ul>
              <li><strong>Slot</strong> — the position in time; use it to open a block directly.</li>
              <li><strong>Block time</strong> — the timestamp the cluster agreed for the block (estimated by stake-weighted votes).</li>
              <li><strong>Leader</strong> — the validator identity that produced the block.</li>
              <li><strong>Parent slot</strong> — the previous block; a gap between parent and slot means skipped slots.</li>
            </ul>
          </Section>

          <Section id="transactions" title="Understanding X1 transactions">
            <p>
              An X1 transaction is an SVM transaction: a list of instructions, each calling a program with a set of accounts, signed by one or more keys.
              It is identified by its first signature (a base58 string). Paste that signature into {page('Search', 'explorer search')} to open the transaction directly. On {page('Transactions', 'Transactions')} you can see recent ones; open any to read:
            </p>
            <ul>
              <li><strong>Status</strong> — success or the program error that made it fail. Failed transactions still pay fees.</li>
              <li><strong>Fee</strong> — paid in XNT by the fee payer (the first signer).</li>
              <li><strong>Instructions and programs</strong> — which programs ran, e.g. the System program for XNT transfers or a token program for token transfers.</li>
              <li><strong>Balance changes</strong> — XNT and token balances before and after, which show what actually moved.</li>
            </ul>
            <p>To verify independently, call <Code>getTransaction</Code> with the signature on an X1 RPC endpoint and compare the result.</p>
          </Section>

          <Section id="validators" title="Validators, stake and leader slots">
            <p>
              X1 uses delegated proof-of-stake. Each validator has an <strong>identity</strong> (node key that signs blocks) and a <strong>vote account</strong>
              that records votes and receives delegated XNT stake. {page('Validators', 'Validators')} lists every vote account with activated stake, commission,
              vote credits and whether it is <em>delinquent</em> (its votes have fallen behind). The {page('StakingCalculator', 'Staking Calculator')} estimates
              rewards from live inflation and stake.
            </p>
            <p>
              Leaders are chosen per epoch in proportion to stake, in runs of four consecutive slots. To see exactly when a validator is scheduled next, use
              {' '}{ext('https://x1-leader-slot-checker.vercel.app/', 'X1 Leader Slot Checker')}, a companion tool dedicated to X1 leader schedules;
              every validator page here links to it.
            </p>
            <p>Validator profiles are keyed by vote account. Compare stake and commission against <Code>getVoteAccounts</Code>. Names and icons can be self-published on-chain and do not establish identity.</p>
          </Section>

          <Section id="tokens" title="Verifying an X1 token (SPL and Token-2022)">
            <p>
              Tokens on X1 are mints owned by one of two SVM token programs. Both are deployed on X1 mainnet:
            </p>
            <ul>
              <li><strong>SPL Token</strong> — <Code>TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA</Code>, the original token program.</li>
              <li><strong>Token-2022</strong> (SPL Token Extensions) — <Code>TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb</Code>, which adds optional extensions such as on-chain metadata, transfer fees and transfer hooks.</li>
            </ul>
            <p>Names, symbols and logos can be copied by anyone. Before trusting a token, check on {page('TokenExplorer', 'Tokens')}:</p>
            <ul>
              <li><strong>Mint address</strong> — the only unique identifier. Compare all characters with the project&apos;s official source.</li>
              <li><strong>Mint authority</strong> — if set, more supply can be created; <em>disabled</em> (null) means supply can never increase.</li>
              <li><strong>Freeze authority</strong> — if set, that key can freeze holder accounts.</li>
              <li><strong>Token-2022 extensions</strong> — a transfer fee or transfer hook changes what happens when you send the token.</li>
              <li><strong>Holder distribution</strong> — a few wallets holding most of the supply is a concentration risk.</li>
            </ul>
            <p>X1 Space reports these facts from on-chain accounts; it does not judge whether a token is legitimate.</p>
          </Section>

          <Section id="pools" title="Liquidity pools">
            <p>
              {page('LPExplorer', 'Liquidity Pools')} shows pools on XDEX, the X1 decentralised exchange: the two reserve tokens, implied price and recent swaps.
              Reserves are read from on-chain pool accounts; prices derived from a pool reflect that pool only and can be moved by large trades in shallow pools.
            </p>
            <p>
              Launching a token, running a fair launch or creating initial liquidity is outside an explorer&apos;s scope; platforms such as
              {' '}{ext('https://x1nexus.xyz/', 'X1 Nexus')} handle that workflow, and the resulting mints and pools can then be inspected here.
            </p>
          </Section>

          <Section id="rpc" title="X1 RPC and developer access">
            <p>
              The public X1 mainnet JSON-RPC endpoint is <Code>https://rpc.mainnet.x1.xyz</Code> (testnet: <Code>https://rpc.testnet.x1.xyz</Code>). It accepts
              standard Solana-compatible methods. Public endpoints are rate-limited per IP (documented as 300 requests per 5 seconds and 150,000 per hour).
              X1 Space&apos;s own JSON endpoints are described in {page('ApiDocs', 'API Docs')}.
            </p>
          </Section>

          <Section id="names" title="X1 is not X1 EcoChain or BlockDAG X1">
            <p>
              Several unrelated projects use the name &quot;X1&quot;. X1 Space covers only the SVM-compatible X1 blockchain documented at
              {' '}{ext('https://docs.x1.xyz/', 'docs.x1.xyz')} (native token XNT). It does not index X1 EcoChain, BlockDAG&apos;s X1 network or any other chain.
            </p>
          </Section>

          <Section id="sources" title="Sources">
            <ul>
              <li>{ext('https://docs.x1.xyz/', 'Introduction to X1')}, {ext('https://docs.x1.xyz/technicals/zero-cost-votes', 'Zero-cost votes')}, {ext('https://docs.x1.xyz/technicals/dynamic-base-fees', 'Dynamic base fees')} — X1 documentation</li>
              <li>{ext('https://docs.x1.xyz/validating/validator-rewards', 'Validator rewards')} (inflation schedule) and {ext('https://docs.x1.xyz/build-on-x1/rpc-rate-limits', 'RPC rate limits')} — X1 documentation</li>
              <li>{ext('https://solana.com/docs/tokens/extensions', 'Token Extensions (Token-2022)')} and {ext('https://solana.com/docs/rpc', 'Solana JSON-RPC reference')}</li>
              <li>Program accounts and epoch schedule read from X1 mainnet RPC on {RPC_CHECKED}</li>
            </ul>
          </Section>
        </Panel>

        <nav aria-label="On this page" className="hidden lg:block">
          <div className="panel sticky top-20 p-4">
            <p className="eyebrow mb-2">On this page</p>
            <ol className="space-y-1.5 text-sm">
              {TOC.map(([id, label]) => (
                <li key={id}><a href={`#${id}`} className="text-ink-muted hover:text-ink">{label}</a></li>
              ))}
            </ol>
          </div>
        </nav>
      </div>
    </>
  );
}
