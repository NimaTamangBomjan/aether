import type { Metadata } from "next";
import { ContactLine, LegalPage } from "@/components/site/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The rules for using GiftLedger, including the free plan, the one-time Season Pass, and refunds.",
};

// DRAFT for the owner's review before launch (CLAUDE.md §13: final legal wording is the owner's call).
// Items marked [owner to confirm] need a decision.
export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        These terms are the agreement between you and GiftLedger when you use the app. By creating an account, you agree
        to them. We&apos;ve kept them short and plain.
      </p>

      <h2>Who can use GiftLedger</h2>
      <p>
        GiftLedger is not designed for children under 13. You must be 13 or older to create an account, and if
        you&apos;re under 18 you need a parent or guardian&apos;s permission.
      </p>

      <h2>Your account</h2>
      <p>
        Keep access to your email secure, since that&apos;s how you sign in. You&apos;re responsible for what happens in your
        account and what you add to your lists, including information about other people.
      </p>

      <h2>Plans and payment</h2>
      <ul>
        <li><strong>Free plan:</strong> up to 5 people, 10 AI idea requests and 1 family member on your list.</li>
        <li>
          <strong>Season Pass:</strong> a one-time payment of $9.99 (plus any tax that applies). It unlocks unlimited
          people, 100 AI idea requests, unlimited family members and return reminders for the list you own, and it lasts
          through January 31, 2027. It is not a subscription and does not renew.
        </li>
        <li>When a pass ends or is refunded, nothing is deleted: you can still view, edit and export everything.</li>
        <li>Payments are processed by Stripe.</li>
      </ul>

      <h2>Refunds</h2>
      <p>
        If you&apos;re not happy with the Season Pass, email <ContactLine /> within 14 days of buying it and we&apos;ll refund
        you in full. A full refund ends the pass. [owner to confirm]
      </p>

      <h2>Family sharing</h2>
      <p>
        The person who owns a list decides who joins. Everyone on a list can see its people and gifts, except gifts hidden
        from them. Members can add gifts and mark what they bought; only the owner can add or change people, budgets and
        invites.
      </p>

      <h2>AI gift ideas</h2>
      <p>
        Gift ideas are suggestions made by AI. They can be wrong or unsuitable, and prices are estimates. Please use your
        own judgment before buying anything.
      </p>

      <h2>Your content</h2>
      <p>
        What you add stays yours. You give us permission to store and process it only to run GiftLedger for you and the
        people you share lists with. Please don&apos;t add sensitive personal information (like health or financial
        details) about anyone.
      </p>

      <h2>Fair use</h2>
      <p>
        Don&apos;t misuse GiftLedger: no breaking the law, harassing people, trying to access other people&apos;s lists,
        overloading the service, or automating requests to get around limits. We may suspend accounts that do.
      </p>

      <h2>Availability and changes</h2>
      <p>
        We work hard to keep GiftLedger running, but we can&apos;t promise it will always be available or error-free. We may
        update the app and these terms; if a change is significant, we&apos;ll tell you in the app or by email.
      </p>

      <h2>Ending your account</h2>
      <p>You can delete your account any time in Settings. We may close accounts that break these terms.</p>

      <h2>Legal stuff</h2>
      <p>
        GiftLedger is provided &ldquo;as is&rdquo;. To the extent the law allows, we aren&apos;t liable for indirect losses,
        and our total liability to you is limited to the amount you paid us in the last 12 months. These terms are
        governed by the laws of the State of [owner to confirm], USA.
      </p>
    </LegalPage>
  );
}
