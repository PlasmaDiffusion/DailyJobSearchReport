/** Defines search settings, text normalization, filtering, and provider queries. */
import { z } from 'zod';
const terms = z.array(z.string().trim().min(1).max(120)).max(20).default([]);

export const configSchema = z.object({
  title: z.string().trim().min(1).max(100),
  mode: z.enum(['jobs', 'news']).default('jobs'),
  companies: terms,
  roles: terms,
  skills: terms,
  locations: terms,
  strictCompany: z.boolean().default(false),
  strictRole: z.boolean().default(false),
  strictSkills: z.boolean().default(false),
  resume: z.string().max(30000).default(''),
  prompt: z.string().max(3000).default(''),
  limit: z.number().int().min(1).max(20).default(10),
}).superRefine((config, context) => {
  if (config.mode === 'news' && !config.prompt.trim()) {
    context.addIssue({
      code: 'custom',
      path: ['prompt'],
      message: 'Enter a news search prompt',
    });
  }

  if (config.mode === 'jobs' && !config.roles.length && !config.companies.length) {
    context.addIssue({
      code: 'custom',
      path: ['roles'],
      message: 'Enter at least one role or company',
    });
  }
});

export type SearchConfig = z.infer<typeof configSchema>;

/** Normalize text so matching ignores case, punctuation, and Unicode variants. */
export const normalize = (value: string): string => value
  .normalize('NFKC')
  .toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim();

/** Build a stable key for detecting a repeated company and job title. */
export const pairKey = (result: { company: string; title: string }): string =>
  `${normalize(result.company)}|${normalize(result.title)}`;

/** Apply the user's enabled company, role, and skill filters to candidate text. */
export function strictMatch(config: SearchConfig, _result: unknown, text: string): boolean {
 const normalizedText = normalize(text);
 const has = (items: string[]) => items.some((item) => normalizedText.includes(normalize(item)));

 return (!config.strictCompany || !config.companies.length || has(config.companies))
  && (!config.strictRole || !config.roles.length || has(config.roles))
  && (!config.strictSkills || config.skills.every((skill) => normalizedText.includes(normalize(skill))));
}

/** Build the web search query for either job listings or news articles. */
export function queryFor(config: SearchConfig): string {
  if (config.mode === 'news') return config.prompt;

  const group = (items) => items.length
    ? `(${items.map((item) => `"${item.replaceAll('"', '')}"`).join(' OR ')})`
    : '';

  return [
    '(site:greenhouse.io OR site:lever.co OR site:myworkdayjobs.com OR site:workday.com)',
    group(config.companies),
    group(config.roles),
    group(config.locations),
    ...config.skills,
  ].filter(Boolean).join(' ');
}
