import { Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Panel } from '@/components/ds/Primitives';
import PageHeader from '@/components/shell/PageHeader';

export default function About() {
  return (
    <>
      <PageHeader icon={Info} title="About X1 Space Explorer" description="An independent explorer and analytics website for X1 mainnet, developed by ARKBS Labs." />
      <Panel as="article" bodyClassName="max-w-3xl space-y-6 p-5 text-sm leading-relaxed text-ink-soft sm:p-7">
        <section aria-labelledby="about-features" className="space-y-2">
          <h2 id="about-features" className="font-display text-lg font-semibold text-ink">What you can explore</h2>
          <p>Look up blocks, transactions, and public addresses. Browse validator profiles, SPL Token and Token-2022 mint records, and XDEX liquidity pools. Network analytics include recent activity, epoch progress, and block production.</p>
        </section>
        <section aria-labelledby="about-audience" className="space-y-2">
          <h2 id="about-audience" className="font-display text-lg font-semibold text-ink">Who it is for</h2>
          <p>X1 Space Explorer is built for anyone who needs to check what happened on X1 mainnet without running a node: holders verifying a transfer, traders inspecting a token mint or liquidity pool before buying, delegators comparing validators and commission, and developers confirming a program or transaction against the chain.</p>
        </section>
        <section aria-labelledby="about-builder" className="space-y-2">
          <h2 id="about-builder" className="font-display text-lg font-semibold text-ink">Who builds it</h2>
          <p>X1 Space Explorer is built and maintained by ARKBS Labs, an independent team that develops tools for the X1 ecosystem, including the X1 Leader Slot Checker and X1 Nexus. The explorer is not operated by the X1 network or its foundation, and it holds no custody of funds and asks for no wallet connection.</p>
        </section>
        <section aria-labelledby="about-sources" className="space-y-2">
          <h2 id="about-sources" className="font-display text-lg font-semibold text-ink">Where the data comes from</h2>
          <p>X1 Space Explorer reads chain data from X1 mainnet RPC and on-chain accounts. Supported liquidity-pool views also use the XDEX API. See the <Link to="/Learn" className="text-brand underline">Explorer Guide</Link> for independent verification steps and the <Link to="/ApiDocs" className="text-brand underline">API Documentation</Link> for endpoint details.</p>
        </section>
        <section aria-labelledby="about-metadata" className="space-y-2">
          <h2 id="about-metadata" className="font-display text-lg font-semibold text-ink">How to interpret names and labels</h2>
          <p>Validator names, token names, icons, and other metadata can be self-published. These labels do not establish authenticity. Compare vote accounts or mint addresses with a trusted source before relying on a listing.</p>
          <p>For questions or suspected data errors, <Link to="/Contact" className="text-brand underline">contact ARKBS Labs</Link>.</p>
        </section>
      </Panel>
    </>
  );
}