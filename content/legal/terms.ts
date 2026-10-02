import type { InfoPage } from './types';

export const terms: InfoPage = {
  title: 'Terms of Use',
  lastUpdated: '2 October 2026',
  testingNotice: true,
  intro:
    'These terms are the rules for using Fileo. By creating an account, you agree to them. Fileo is a personal project in early testing, built and run by Ebunoluwa Oyetunji.',
  sections: [
    {
      heading: 'What Fileo is',
      body: [
        'Fileo helps freelancers in Nigeria prepare a personal income tax return. It brings together your platform and bank statements, works out your income, applies your deductions and calculates your tax.',
        'Fileo is in early testing. Features may change, stop working or be removed, and test information may sometimes need to be reset. Fileo is free while it’s in testing.',
        'Fileo isn’t a tax adviser, and nothing is filed with any tax authority during early testing.',
        { links: [{ label: 'Tax disclaimer', page: 'tax-disclaimer' }] },
      ],
    },
    {
      heading: 'Your account',
      body: [
        {
          bullets: [
            'You need to be 18 or older.',
            'Use your own details, and keep your password to yourself.',
            'One account per person.',
            'You’re responsible for what happens in your account. If you think someone else has used it, change your password and send feedback.',
          ],
        },
      ],
    },
    {
      heading: 'What you enter and confirm',
      body: [
        'You’re responsible for the information you give Fileo: your income, expenses, deductions and documents. Check that they’re correct and complete.',
        'Amounts suggested by AI reading can be wrong. Check them against your statements before you confirm.',
        'When you tap “Approve and submit”, you confirm the return is correct and complete. After that, it can’t be changed.',
      ],
    },
    {
      heading: 'Acceptable use',
      body: [
        {
          bullets: [
            'During early testing, use test details only, not your real BVN, NIN or bank statements.',
            'Only upload documents you have the right to use.',
            'Don’t try to get into other people’s accounts or information.',
            'Don’t try to break, overload or get around how Fileo works, and don’t upload anything harmful.',
            'Don’t use Fileo for anything illegal.',
          ],
        },
      ],
    },
    {
      heading: 'Your information',
      body: [
        'Your documents and information stay yours. You allow Fileo to store and use them to prepare your return, and to send your statements to the AI service if you turn AI reading on.',
        { links: [{ label: 'Privacy Policy', page: 'privacy' }] },
      ],
    },
    {
      heading: 'Limits of liability',
      body: [
        'Fileo is provided as it is, during testing, with no guarantee that it will always work or be free of mistakes.',
        'As far as the law allows, Fileo and its maker aren’t responsible for any loss from using it. That includes tax owed, penalties, interest, or mistakes in a calculation or return.',
      ],
    },
    {
      heading: 'Ending your use',
      body: [
        'You can stop using Fileo at any time and ask for your account to be deleted. Accounts that break these terms may be suspended or deleted.',
      ],
    },
    {
      heading: 'Changes to these terms',
      body: [
        'If these terms change, this page will be updated and the date at the top will change. If you keep using Fileo after a change, you accept the new terms.',
      ],
    },
    {
      heading: 'Law',
      body: ['These terms are governed by the laws of the Federal Republic of Nigeria.'],
    },
  ],
};
