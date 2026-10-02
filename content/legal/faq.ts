import type { InfoPage } from './types';

export const faq: InfoPage = {
  title: 'Help and FAQ',
  intro: 'Quick answers to the questions people ask most. Tap a question to see the answer.',
  sections: [],
  questions: [
    {
      question: 'What documents do I need?',
      answer: [
        'A statement for each platform or bank where you received money in the tax year, such as a transaction report or income statement.',
        'For each deduction you claim, its proof: your PFA statement for pension, your NHF contribution statement, or your insurance premium receipt. Rent relief starts with 2026 income and needs your rent receipt.',
        'Files can be PDF, JPG, PNG or HEIC, up to 10 MB each.',
      ],
    },
    {
      question: 'What counts as income?',
      answer: [
        'Money you earned from your work: payments from clients, what you earned on platforms like Upwork or Paystack, and money paid into your bank for your work.',
        'It doesn’t include transfers between your own accounts, loans, refunds, reversals, or payouts from a platform you’ve already counted.',
      ],
    },
    {
      question: 'Do I have to use AI reading?',
      answer: [
        'No. Choose “Enter manually” and type your income yourself. If you do use it, you check and confirm every amount.',
        { links: [{ label: 'How Fileo uses AI', page: 'ai' }] },
      ],
    },
    {
      question: 'What if I make a mistake?',
      answer: [
        'Until you submit, you can go back to any step and change it. Return Review lists anything that’s missing, with a “Fix” button that takes you straight to it.',
      ],
    },
    {
      question: 'Why can’t I edit after submitting?',
      answer: [
        'A submitted return is a record of exactly what you confirmed, so it’s locked, and so are its documents. That way the record always matches what was submitted. If something’s wrong, send feedback.',
      ],
    },
    {
      question: 'How are tax bands worked out?',
      answer: [
        'First, Fileo takes your income and subtracts your business expenses, reliefs and deductions. What’s left is your taxable income.',
        'Your taxable income is then split into bands. Each band has its own rate, and only the part of your income inside a band is taxed at that rate. For 2025 income, a minimum tax of 1% applies if the tax from the bands is lower.',
        'To see your own breakdown, tap “How tax bands work” on Home or Return Review.',
      ],
    },
    {
      question: 'Is my BVN stored?',
      answer: [
        'No. Your BVN and NIN are checked once, then only the last 4 digits are kept. During early testing, the check is a test check, and your numbers aren’t sent to any verification service.',
      ],
    },
    {
      question: 'How do I delete a document?',
      answer: [
        'Open the Documents tab, tap the document, then tap “Delete document”. Documents that are part of a submitted return can’t be deleted.',
      ],
    },
    {
      question: 'How do I turn off AI reading?',
      answer: [
        'Go to Profile and turn off “Read statements with AI”. New statements won’t be read, and you type your income yourself.',
      ],
    },
    {
      question: 'When is my return due?',
      answer: [
        'By 31 March of the following year. For example, your 2025 return is due by 31 March 2026. Home shows how many days you have left.',
      ],
    },
    {
      question: 'Does Fileo file my return with the tax authority?',
      answer: [
        'Not yet. During early testing, submitting saves your return in Fileo, but nothing is sent to FIRS or any state tax service.',
        { links: [{ label: 'Tax disclaimer', page: 'tax-disclaimer' }] },
      ],
    },
    {
      question: 'How do I report a problem or share an idea?',
      answer: [
        'Tap “Send feedback” in Profile or on the About page. Every message is read.',
      ],
    },
  ],
};
