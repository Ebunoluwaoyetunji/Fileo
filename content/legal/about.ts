import type { InfoPage } from './types';

export const about: InfoPage = {
  title: 'About Fileo',
  testingNotice: true,
  intro:
    'Fileo is a tax filing app for Nigerian freelancers. It turns your platform and bank statements into a finished personal income tax return, one step at a time.',
  sections: [
    {
      heading: 'Why Fileo',
      body: [
        'Filing as a freelancer means gathering statements from several platforms, separating real income from transfers, applying the right reliefs and working out the tax. Fileo does the adding up, shows its working and tells you what’s still missing.',
      ],
    },
    {
      heading: 'Who makes it',
      body: [
        'Fileo is designed and built by Ebunoluwa Oyetunji. It’s a personal project, not a company.',
      ],
    },
    {
      heading: 'Early testing',
      body: [
        'Fileo is free while it’s being tested, and it changes often. Nothing is filed with any tax authority yet. Your feedback shapes what comes next.',
      ],
    },
  ],
};
