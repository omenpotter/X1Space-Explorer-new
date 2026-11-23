import { Mail } from 'lucide-react';
import { Panel } from '@/components/ds/Primitives';
import PageHeader from '@/components/shell/PageHeader';

export default function Contact() {
  return (
    <>
      <PageHeader icon={Mail} title="Contact and support" description="Get in touch with ARKBS Labs about X1 Space Explorer." />
      <Panel as="article" bodyClassName="max-w-3xl space-y-6 p-5 text-sm leading-relaxed text-ink-soft sm:p-7">
        <section aria-labelledby="support-email" className="space-y-2">
          <h2 id="support-email" className="font-display text-lg font-semibold text-ink">Official support email</h2>
          <p><a href="mailto:support@arkbslabs.com" className="text-brand underline">support@arkbslabs.com</a></p>
          <p>Use this address for explorer technical support, incorrect or missing data reports, website bugs, general enquiries, or privacy-related enquiries.</p>
        </section>
        <section aria-labelledby="support-reports" className="space-y-2">
          <h2 id="support-reports" className="font-display text-lg font-semibold text-ink">Reporting an issue</h2>
          <p>Include the affected URL, what you expected, and what happened. Where relevant, include a public block slot, transaction signature, validator vote account, or token mint address.</p>
          <p><strong className="text-ink">Never share seed phrases, private keys, or passwords.</strong></p>
        </section>
      </Panel>
    </>
  );
}
