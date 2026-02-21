import Layout from "@/components/Layout";

const TermsPage = () => (
  <Layout>
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="font-pixel text-lg text-primary mb-6 glow-gold">Terms of Service</h1>
      <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
        <p><strong className="text-foreground">Last updated:</strong> January 2025</p>
        <h2 className="font-pixel text-xs text-foreground pt-4">Acceptance of Terms</h2>
        <p>By accessing verdict.games, you agree to be bound by these Terms of Service. If you do not agree, please do not use the site.</p>
        <h2 className="font-pixel text-xs text-foreground pt-4">User Content</h2>
        <p>By submitting reviews, comments, or other content, you grant verdict.games a non-exclusive, worldwide license to display and distribute your content on our platform.</p>
        <h2 className="font-pixel text-xs text-foreground pt-4">Prohibited Conduct</h2>
        <p>Users may not submit fake reviews, spam, hate speech, or any content that violates applicable laws. We reserve the right to remove content and ban users who violate these terms.</p>
        <h2 className="font-pixel text-xs text-foreground pt-4">Intellectual Property</h2>
        <p>All site content, design, and branding are owned by verdict.games. Game titles, logos, and assets belong to their respective rights holders.</p>
        <h2 className="font-pixel text-xs text-foreground pt-4">Limitation of Liability</h2>
        <p>verdict.games is provided "as is" without warranties. We are not liable for any damages arising from your use of the site.</p>
      </div>
    </div>
  </Layout>
);

export default TermsPage;
