import Layout from "@/components/Layout";

const PrivacyPage = () => (
  <Layout>
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="font-pixel text-lg text-primary mb-6 glow-gold">Privacy Policy</h1>
      <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
        <p><strong className="text-foreground">Last updated:</strong> January 2025</p>
        <h2 className="font-pixel text-xs text-foreground pt-4">Information We Collect</h2>
        <p>We collect information you provide directly, such as when you create an account, submit a review, or contact us. This may include your username, email address, and review content.</p>
        <h2 className="font-pixel text-xs text-foreground pt-4">How We Use Your Information</h2>
        <p>We use collected information to operate and improve the site, display reviews, communicate with you, and ensure a safe experience for all users.</p>
        <h2 className="font-pixel text-xs text-foreground pt-4">Cookies</h2>
        <p>We use essential cookies to maintain your session and preferences. We may use analytics cookies to understand how visitors interact with our site.</p>
        <h2 className="font-pixel text-xs text-foreground pt-4">Third-Party Services</h2>
        <p>We may use third-party services for analytics, hosting, and content delivery. These services may collect data independently under their own privacy policies.</p>
        <h2 className="font-pixel text-xs text-foreground pt-4">Contact</h2>
        <p>For privacy concerns, please contact us at privacy@verdict.games.</p>
      </div>
    </div>
  </Layout>
);

export default PrivacyPage;
