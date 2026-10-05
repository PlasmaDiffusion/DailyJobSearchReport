Backend: A NodeJS/Express backend uses openAI, google custom search api, and firecrawl. Every there will be automated searches for jobs based on conditions provided (specific companies, job titles, locations, and the user's resume.) The user will send a job search request code as well for later. Additionally instead of the previously mentioned conditions, there can be specific prompt searches for news on any new tech that could be key for software developers to learn.



Main Plan / Architecture:
+-----------------------------------------------------------------------------------+
|                                   DAILY CRON JOB                                  |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
| STEP 1: Search API (Google Custom Search)                    |
| - Query: "site:greenhouse.io OR site:lever.co OR site:workday.com [Company] [Role]"|
| - Fetch live posting links & snippets without feeding resume yet
| - The user sets the amount of results to look for (with a hard limit)              |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
| STEP 2: Scrape Job Details (Optional/Recommended)                                 |
| - Pull full job text from returned link using Firecrawl             |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
| STEP 3: OpenAI API Call (Batch or Individual Prompt)                              |
| - Input: System Prompt + Resume Text + Scraped Job Description                    |
| - Output: JSON evaluation (Fit Score, Key Gaps, Resume Match Summary, Link)       |
+-----------------------------------------------------------------------------------+



After this main flow there will be a Job Search Report of all job titles that were found that day with links to them and a brief description of them, and any notable ways they match to your resume. This can be saved to the backend database with neonDB and fetched on the frontend using a job search code the user initially provided.


Frontend:
React app (with react router and tailwind)

The UI will be a page with "Job Search Tabs" at the bottom that list these conditions, and a + to make a new tab (mimicking tabs in a browser). The tab text will be a title of the user's choosing.


When on a tab, at the top of the screen there will be conditions to set

-specific companies
-job titles
-specific skills the job titles should list
-option to ONLY show results that contain the company, or specific skills, or specific job title (if unchecked it's much more free form)
-locations
-the user's resume
-the number of jobs the user expects to be returned in a Job Search Report (capped at 20)
-there's also an alternate news mode (with a radio button toggle) to search for news or articles related to the tech industry
-job search code (this is automatically generated when a Job Search Tab is created and can't be changed)

After this section there will be a list of Job Search Report results found that day.

Persistent Front End Data:

Job Search Tabs will get saved to local storage.

At the end of the job report you have the option to save all the output Job Search Reports text/json to local storage. There will be something on the site at the far top right that says how much data has been used up in the local storage for this website. After the user manually clicks "Delete older job search reports 30+ days old" and hits confirm in a modal, all saved Job Search Reports are automatically deleted if they were created 30 days ago or longer.