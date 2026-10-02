import type { InfoPage } from './types';

export const privacy: InfoPage = {
  title: 'Privacy Policy',
  lastUpdated: '2 October 2026',
  testingNotice: true,
  intro:
    'This policy explains what Fileo collects, why, where it’s kept and who else sees it. Fileo is a personal project in early testing, built and run by Ebunoluwa Oyetunji. There’s no company behind it yet.',
  sections: [
    {
      heading: 'What Fileo collects',
      body: [
        {
          bullets: [
            'Your account: your name, email address, phone number and password. Your password is stored only in scrambled form, so nobody can read it.',
            'Your identity check: the last 4 digits of your BVN and NIN, whether the check passed, and a record of each attempt (the masked number, the result and the time). The record is how Fileo limits checks to 5 a day.',
            'Your return: the platforms and banks you choose, your income, business expenses and deductions, your tax calculation, and your return’s status and reference number.',
            'Your documents: the files you upload (PDF, JPG, PNG or HEIC, up to 10 MB each), with their name, type, size and category.',
            'Statement reading results, only if you turn AI reading on: the payments found in each statement (date, amount, description and how each was counted) and your answers about payments the AI wasn’t sure about.',
            'Your choices, such as whether you allowed AI reading and when.',
          ],
        },
        'Fileo doesn’t use analytics, advertising or tracking tools, and doesn’t collect your location or contacts. If you confirm a change with your fingerprint or face, your phone checks it. Fileo never receives it.',
      ],
    },
    {
      heading: 'What Fileo doesn’t store',
      body: [
        {
          bullets: [
            'Your full BVN or NIN. Each number is checked once and then masked, so only the last 4 digits are kept.',
            'Bank logins or card details. Fileo never asks for them, and connecting a bank isn’t built.',
          ],
        },
        'During early testing, the identity check is a test check. Your numbers aren’t sent to any verification service.',
      ],
    },
    {
      heading: 'Why it’s used',
      body: [
        {
          bullets: [
            'To create and protect your account, and to send your sign-in and verification codes.',
            'To prepare your return: work out your tax, show what’s still missing and save your progress.',
            'To read your statements and suggest your income, only if you allow it.',
          ],
        },
        'Your information isn’t used for advertising and is never sold.',
      ],
    },
    {
      heading: 'Where it’s stored',
      body: [
        'Everything is stored with Supabase, which runs Fileo’s database, file storage and sign-in. Information travels over encrypted connections.',
        'Your files are kept in a private storage area with no public links. The database only lets your account read your own information.',
      ],
    },
    {
      heading: 'Who it’s shared with',
      body: [
        {
          bullets: [
            'Supabase, to store your information and run sign-in.',
            'An email delivery service, to send your sign-up, password reset and email change codes. It receives your email address and the message.',
            'Anthropic, the company that makes the Claude AI, only if AI reading is on. It receives each statement you upload for a platform or bank, reads the payments and sends them back. Receipts and other documents are never sent. Anthropic doesn’t use them to train its AI.',
          ],
        },
        'Nothing is sent to FIRS, a state tax service or anyone else during early testing. Nobody else receives your information.',
        { links: [{ label: 'How Fileo uses AI', page: 'ai' }] },
      ],
    },
    {
      heading: 'How long it’s kept',
      body: [
        'Your information is kept while your account exists. You can delete a document at any time, unless it’s part of a return you’ve submitted. Those stay with the return.',
        'If you ask for your account to be deleted, your account and everything linked to it will be deleted.',
      ],
    },
    {
      heading: 'Your rights',
      body: [
        {
          bullets: [
            'See your information: your profile, documents and returns are all in the app.',
            'Correct it: edit your profile, or change any step of your return before you submit it.',
            'Delete it: delete documents yourself, or send feedback to ask for your whole account to be deleted.',
            'Stop AI reading: turn off “Read statements with AI” in Profile at any time.',
            'Ask a question or complain: send feedback. You can also contact the Nigeria Data Protection Commission.',
          ],
        },
      ],
    },
    {
      heading: 'Age',
      body: ['Fileo is for adults filing their own taxes. You need to be 18 or older to use it.'],
    },
    {
      heading: 'Changes to this policy',
      body: [
        'If this policy changes, this page will be updated and the date at the top will change. Big changes will be pointed out in the app.',
      ],
    },
  ],
};
