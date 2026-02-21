import Layout from "@/components/Layout";

const DisclaimerPage = () => (
  <Layout>
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="font-pixel text-lg text-primary mb-6 glow-gold">Disclaimer</h1>
      <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
        <p>The information provided on verdict.games is for general informational purposes only. All reviews represent the personal opinions of our reviewers and the community.</p>
        <p>Game scores are subjective and based on our review criteria. Your personal experience may differ based on hardware, preferences, and play style.</p>
        <p>We do not guarantee the accuracy, completeness, or usefulness of any information on this site. Game performance metrics are approximate and may vary across hardware configurations.</p>
        <p>verdict.games is not affiliated with any game developers or publishers unless explicitly stated. All game titles, trademarks, and assets belong to their respective owners.</p>
        <p>We may earn affiliate commissions from links on this site. This does not influence our review scores or editorial content.</p>
      </div>
    </div>
  </Layout>
);

export default DisclaimerPage;
