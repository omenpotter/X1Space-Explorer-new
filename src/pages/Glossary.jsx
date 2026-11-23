import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookMarked } from 'lucide-react';
import PageHeader from '@/components/shell/PageHeader';
import { Panel } from '@/components/ds/Primitives';
import { base44 } from '@/api/base44Client';

const UPDATED = '2026-11-23';

// Fixed order so the page reads the same on every visit, whatever order records come back in.
const CATEGORIES = [
  ['network', 'Network and blocks'],
  ['validators', 'Validators and staking'],
  ['tokens', 'Tokens and mints'],
  ['markets', 'Markets and liquidity'],
];

export default function Glossary() {
  const [terms, setTerms] = useState([]);

  useEffect(() => {
    let alive = true;
    base44.entities.GlossaryTerm.filter({}, { sort: 'sort_order', limit: 100 })
      .then((page) => {
        if (alive) setTerms(page.items ?? []);
      })
      .catch(() => {
        if (alive) setTerms([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const groups = CATEGORIES.map(([key, label]) => ({ key, label, items: terms.filter((t) => t.category === key) })).filter((g) => g.items.length > 0);

  return (
    <>
      <PageHeader
        icon={BookMarked}
        title="X1 blockchain glossary"
        description="The words X1 Space Explorer uses for X1 mainnet records, and what each one means on this site."
        meta={<p className="text-xs text-ink-faint">By ARKBS Labs · Updated <time dateTime={UPDATED}>23 November 2026</time></p>}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <Panel as="article" bodyClassName="max-w-3xl space-y-6 p-5 text-sm leading-relaxed text-ink-soft sm:p-7" aria-label="X1 terminology">
          <section aria-labelledby="glossary-intro" className="space-y-3">
            <h2 id="glossary-intro" className="font-display text-lg font-semibold text-ink">Why a shared vocabulary matters</h2>
            <p>
              X1 is a layer-1 blockchain that executes the Solana Virtual Machine, so accounts, transactions and programs on X1 follow the
              same model as Solana. X1 Space Explorer reads that model directly from X1 mainnet RPC and from on-chain accounts. Because a
              single number can be described in several ways, this glossary fixes what each word means here: a figure labelled with one of
              these terms means the same thing on the dashboard, in the tables, and in the API documentation.
            </p>
            <p>
              The network vocabulary is about time and production. Time is divided into slots, and in each slot one validator, the leader,
              may produce a block. A slot that ends without a block is skipped, which is why block height and slot number drift apart over
              time. Slots are grouped into epochs, and stake, inflation and the leader schedule are recalculated at epoch boundaries.
              Skip rate and vote credits describe how reliably a validator took its scheduled turns.
            </p>
            <p>
              The token vocabulary is about authority. A mint address is the only unique identifier of a token, because a name, symbol or
              logo can be copied by anyone. A mint authority that is still set can create more supply; when it is disabled the supply is
              fixed for good. A freeze authority can stop holder accounts from moving the token, and Token-2022 mints can carry extensions
              such as a transfer fee or a transfer hook that change what happens when the token is sent.
            </p>
            <p>
              The market vocabulary is about reserves. A liquidity pool holds two token reserves and prices one against the other, so a price
              read from a pool describes that pool only and moves when someone trades in it. A transaction signature is the first signature
              on a transaction and the identifier to search for, and a vote account is the on-chain record that carries a validator&apos;s
              votes and delegated stake.
            </p>
          </section>

          {groups.length > 0 ? (
            <section aria-labelledby="glossary-terms" className="space-y-5">
              <h2 id="glossary-terms" className="font-display text-lg font-semibold text-ink">Terms</h2>
              {groups.map((group) => (
                <div key={group.key} className="space-y-3">
                  <h3 className="eyebrow">{group.label}</h3>
                  <dl className="space-y-3">
                    {group.items.map((t) => (
                      <div key={t.id} className="border-l-2 border-line pl-3">
                        <dt className="font-display text-sm font-semibold text-ink">
                          {t.term}
                          {t.aliases ? <span className="ml-2 text-xs font-normal text-ink-faint">also {t.aliases}</span> : null}
                        </dt>
                        <dd className="mt-1 text-sm text-ink-soft">
                          {t.description}
                          {t.related_url ? (
                            <Link to={t.related_url} className="ml-1 text-brand underline underline-offset-2 hover:text-brand-strong">See it on the explorer</Link>
                          ) : null}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </section>
          ) : null}

          <section aria-labelledby="glossary-next" className="space-y-2">
            <h2 id="glossary-next" className="font-display text-lg font-semibold text-ink">Where to check a term in practice</h2>
            <p>
              The <Link to="/Learn" className="text-brand underline underline-offset-2 hover:text-brand-strong">Explorer Guide</Link> walks through
              reading a block, a transaction and a validator record end to end, and the{' '}
              <Link to="/ApiDocs" className="text-brand underline underline-offset-2 hover:text-brand-strong">API Documentation</Link> lists the
              endpoints behind each figure so you can confirm it against X1 RPC yourself.
            </p>
          </section>
        </Panel>

        <nav aria-label="On this page" className="hidden lg:block">
          <div className="panel sticky top-20 p-4">
            <p className="eyebrow mb-2">On this page</p>
            <ol className="space-y-1.5 text-sm">
              <li><a href="#glossary-intro" className="text-ink-muted hover:text-ink">Why a shared vocabulary matters</a></li>
              {groups.length > 0 ? <li><a href="#glossary-terms" className="text-ink-muted hover:text-ink">Terms</a></li> : null}
              <li><a href="#glossary-next" className="text-ink-muted hover:text-ink">Where to check a term</a></li>
            </ol>
          </div>
        </nav>
      </div>
    </>
  );
}