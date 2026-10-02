import type { InfoPage } from './types';

export const taxDisclaimer: InfoPage = {
  title: 'Tax disclaimer',
  lastUpdated: '2 October 2026',
  intro:
    'Fileo helps you prepare a personal income tax return. Here’s what it does, and what it doesn’t.',
  sections: [
    {
      heading: 'Fileo calculates. It doesn’t advise.',
      body: [
        'Fileo works out your tax from the information you give it, using Nigeria’s personal income tax rules for that year. For 2025 income, that’s the Personal Income Tax Act as amended. From 2026, it’s the Nigeria Tax Act 2025.',
        'Fileo isn’t a tax adviser, accountant or lawyer. Nothing in the app is tax advice.',
      ],
    },
    {
      heading: 'Your numbers, your responsibility',
      body: [
        'Your tax is only as accurate as what you enter and confirm. Check your income, expenses and deductions against your records.',
      ],
    },
    {
      heading: 'Nothing is filed during early testing',
      body: [
        'Submitting a return in Fileo saves it and gives you a reference number. Nothing is sent to FIRS, a state tax service or anyone else.',
        'The steps you see after submitting, like “Professional review” and “Filed with LIRS”, show how filing will work later. They don’t happen yet.',
      ],
    },
    {
      heading: 'Filing your real return',
      body: [
        'File your actual return yourself with the tax service of the state you live in (for example, LIRS in Lagos), or through a tax professional.',
        'Deadlines shown in Fileo are a guide: returns are usually due by 31 March of the following year.',
      ],
    },
    {
      heading: 'Rules change',
      body: [
        'Tax rules and rates are checked against the law, but they can change or be read differently. If you’re not sure about your situation, speak to a qualified tax professional.',
      ],
    },
  ],
};
