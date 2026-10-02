import type { InfoPage } from './types';

export const ai: InfoPage = {
  title: 'How Fileo uses AI',
  lastUpdated: '2 October 2026',
  intro:
    'Fileo can read the statements you upload and suggest how much you earned. It’s optional, and you always check the numbers before anything is submitted.',
  sections: [
    {
      heading: 'What it does',
      body: [
        'For each platform or bank statement you upload, the AI finds the money you received in the tax year. It sorts each payment into one of these groups:',
        {
          bullets: [
            'Income',
            'Transfers between your own accounts',
            'Refunds, loans and reversals',
            'Payouts you’ve already counted under another platform',
            'Payments outside the tax year',
          ],
        },
        'Fileo then adds up your income and suggests the amount. If the AI isn’t sure about a payment, Fileo asks you.',
      ],
    },
    {
      heading: 'What is sent',
      body: [
        'Only the statement file and the tax year. Receipts, pension statements and other documents are never sent, and neither are your name, BVN, NIN or phone number.',
      ],
    },
    {
      heading: 'Who reads it',
      body: [
        'Anthropic, the company that makes the Claude AI, reads each statement for Fileo and sends back the payments it found. Anthropic doesn’t use your statements to train its AI.',
        'The payments it finds are saved with your return, so you can see how your income was worked out.',
      ],
    },
    {
      heading: 'You stay in control',
      body: [
        {
          bullets: [
            'It’s only a suggestion. You can change any amount.',
            'You answer the payments the AI wasn’t sure about.',
            '“See breakdown” shows every payment and how it was counted, and you can move any of them.',
            'You confirm your income before you continue, and again before you submit.',
          ],
        },
      ],
    },
    {
      heading: 'When it can’t read a statement',
      body: [
        'Some files can’t be read: blurry photos, password-protected PDFs and files over 20 pages. Statements that cover the wrong year, or only part of it, are flagged for you to check. There’s also a daily limit on how many statements can be read. When something goes wrong, Fileo tells you why, and you can type the amount yourself.',
      ],
    },
    {
      heading: 'Turning it off',
      body: [
        'AI reading only starts if you choose “Allow”. To stop it, turn off “Read statements with AI” in Profile. New statements won’t be read, and you type your income yourself. Statements already read keep their results.',
      ],
    },
  ],
};
