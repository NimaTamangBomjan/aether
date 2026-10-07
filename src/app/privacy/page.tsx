import type { Metadata } from "next";
import { ContactLine, LegalPage } from "@/components/site/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What GiftLedger collects, why, who helps us run the app, and how to export or delete your data.",
};

// DRAFT for the owner's review before launch (CLAUDE.md §13: final legal wording is the owner's call).
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        GiftLedger helps you plan holiday gifts. This page explains, in plain language, what information we keep, why,
        and the choices you have. We don&apos;t sell your information and we don&apos;t show ads.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Your account:</strong> your email address, the name you choose, your time zone and email settings.</li>
        <li>
          <strong>What you put on your lists:</strong> the people you shop for (names, relationships, age ranges,
          interests, notes, budgets) and their gifts (titles, prices, stores, dates, links, notes). This can include
          information about other people, including children. Please only add what you need to plan gifts.
        </li>
        <li><strong>Family sharing:</strong> who is on each list and who marked a gift bought.</li>
        <li>
          <strong>Payments:</strong> Stripe handles payment. We receive whether you paid, the amount, and a payment
          reference. We never see or store your card number.
        </li>
        <li>
          <strong>Usage and errors:</strong> how many AI idea requests you&apos;ve used, basic usage statistics without
          cookies, and error reports that help us fix bugs.
        </li>
        <li>
          <strong>Sign-in records:</strong> when you signed in, kept for 30 days for security. If you start signing up
          but never enter the code, that unfinished account is deleted after a day.
        </li>
        <li>
          <strong>Invites you email:</strong> we use the address only to send that one invite. To stop people being
          emailed again and again, we keep a one-way fingerprint of it (not the address) for 30 days.
        </li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To run GiftLedger: your lists, budgets, family sharing and limits.</li>
        <li>To send emails you need or asked for: sign-in codes, a welcome note, family invites, payment receipts and return reminders. You can turn reminders off in Settings or with the link in any reminder.</li>
        <li>To prevent abuse and keep the service secure.</li>
        <li>To understand, in aggregate, which features help, and to fix problems.</li>
      </ul>

      <h2>AI gift ideas</h2>
      <p>
        When you tap &ldquo;Get gift ideas&rdquo;, we send the person&apos;s age range, relationship, interests, notes,
        &ldquo;don&apos;t buy&rdquo; notes and remaining budget to our AI provider, Anthropic, to come up with ideas. Before
        sending, we remove the person&apos;s name, the names of people on your list, and any email addresses, phone
        numbers or links we can detect. Please don&apos;t put names or sensitive details in notes. Under its commercial
        terms, Anthropic does not use this data to train its models.
      </p>

      <h2>Who helps us run GiftLedger</h2>
      <p>We share information only with companies that provide the service for us, and only what they need:</p>
      <ul>
        <li>Supabase (database and sign-in)</li>
        <li>Vercel (hosting)</li>
        <li>Stripe (payments)</li>
        <li>Anthropic (AI gift ideas)</li>
        <li>Resend (email)</li>
        <li>PostHog (usage statistics, without cookies)</li>
        <li>Sentry (error reports)</li>
        <li>Cloudflare (checks that sign-ins come from a person, not a bot)</li>
      </ul>
      <p>We may also share information if the law requires it, or to protect people&apos;s safety.</p>

      <h2>Cookies</h2>
      <p>
        We only use cookies that the app needs to work: one keeps you signed in, and one remembers which list you were
        looking at. Our usage statistics don&apos;t use cookies.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep your information while you have an account. When you delete your account, we delete your personal
        information from GiftLedger, including your sign-in records. We keep basic payment records (amount and date,
        without your name) because tax law requires it. Backups are deleted on a rolling basis within 30 days. The
        companies that help us run GiftLedger keep their own short-term records (for example email delivery logs and
        error reports) and delete them on their own schedules; Stripe keeps payment records as the law requires.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li><strong>Export:</strong> download everything you can see as a spreadsheet from Settings, any time, on any plan.</li>
        <li><strong>Delete:</strong> delete your account from Settings. Shared lists you own pass to a family member you choose.</li>
        <li><strong>Emails:</strong> turn off return reminders in Settings or from any reminder email.</li>
        <li><strong>Questions or corrections:</strong> contact us at <ContactLine />.</li>
      </ul>
      <p>Depending on where you live (for example California), you may have extra rights. Contact us and we&apos;ll help.</p>

      <h2>Children</h2>
      <p>
        GiftLedger is not designed for children under 13, and you must be 13 or older to create an account. We don&apos;t
        knowingly collect information from children under 13. Adults may add details about children they buy gifts for
        (such as an age range and interests); we use these only to plan gifts. If you think a child under 13 has made an
        account, contact us and we&apos;ll delete it.
      </p>

      <h2>Security</h2>
      <p>
        Information is encrypted when it travels between your device and our servers. Each list is protected so only
        the people on it can see it, and a gift hidden from someone is never shown to them.
      </p>

      <h2>Changes</h2>
      <p>If we change this policy in a meaningful way, we&apos;ll update the date above and let you know in the app or by email.</p>
    </LegalPage>
  );
}
