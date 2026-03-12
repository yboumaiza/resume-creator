<?php

class PromptBuilder
{
    public function analyzeJd(string $jobDescription): string
    {
        return <<<PROMPT
You are a career strategist. Analyze the following job description and extract structured information.

JOB DESCRIPTION:
{$jobDescription}

Respond with a JSON object:
{
  "required_skills": ["list of explicitly required technical and soft skills"],
  "preferred_skills": ["list of preferred/nice-to-have/bonus skills"],
  "key_responsibilities": ["list of core job responsibilities"],
  "seniority_level": "Junior|Mid|Senior|Lead|Staff|Principal",
  "employment_type": "Full-time|Part-time|Contract|Internship"
}

Rules:
- "required_skills" = skills explicitly listed as required, mandatory, or essential. Use the exact terminology from the job description.
- "preferred_skills" = skills listed as preferred, nice-to-have, bonus, or "experience with X is a plus". Return an empty array if none mentioned.
- "key_responsibilities" = the main duties and expectations of the role. Keep each item concise (one sentence).
- "seniority_level" = infer from years of experience, title, and scope of responsibilities. If unclear, default to "Mid".
- "employment_type" = infer from the job description. If not mentioned, default to "Full-time".
- Extract ONLY what the job description states or strongly implies. Do not add skills or responsibilities not present.

Respond ONLY with the JSON object, no additional text.
PROMPT;
    }

    public function filterSkills(array $jobAnalysis, string $itemLabel, array $itemSkills, string $itemDescription): string
    {
        $analysisJson = json_encode($jobAnalysis, JSON_PRETTY_PRINT);
        $skillsList = implode(', ', $itemSkills);

        return <<<PROMPT
You are a resume relevance analyst. Given a job analysis and a single resume item, determine which of the item's skills are relevant to the target role.

JOB ANALYSIS:
{$analysisJson}

RESUME ITEM: {$itemLabel}
Item's Skills: [{$skillsList}]
Item's Description: {$itemDescription}

Respond with a JSON object:
{
  "relevant_skills": ["only the skills from the item that are relevant to this job"],
  "relevance_score": 75
}

Rules:
- ONLY include skills from the "Item's Skills" list above. Do NOT add new skills.
- A skill is relevant if it matches or closely relates to any required_skills, preferred_skills, or key_responsibilities from the job analysis.
- "relevance_score" is 0-100 representing how relevant this entire item is to the target job. 0 = no connection, 50 = somewhat related, 80+ = strong match.
- Be strict: if a skill has no clear connection to the job, exclude it.
- If no skills are relevant, return an empty array and a low score.

Respond ONLY with the JSON object, no additional text.
PROMPT;
    }

    public function sortSkills(array $jobAnalysis, array $relevantSkills): string
    {
        $analysisJson = json_encode($jobAnalysis, JSON_PRETTY_PRINT);
        $skillsList = json_encode($relevantSkills);

        return <<<PROMPT
You are a resume optimization expert. Given a job analysis and a list of relevant skills, sort them from most to least important for the target role.

JOB ANALYSIS:
{$analysisJson}

SKILLS TO SORT:
{$skillsList}

Respond with a JSON object:
{
  "sorted_skills": ["most important skill first", "second most important", "..."]
}

Rules:
- Return the EXACT SAME skills, just reordered. Do not add, remove, or rename any skill.
- Skills matching required_skills should rank higher than those matching preferred_skills.
- Skills directly mentioned in key_responsibilities rank highest.
- If two skills are equally relevant, maintain their original order.

Respond ONLY with the JSON object, no additional text.
PROMPT;
    }

    public function experienceBullets(array $jobAnalysis, string $itemLabel, string $itemDescription, array $sortedSkills, array $previousBullets): string
    {
        $analysisJson = json_encode($jobAnalysis, JSON_PRETTY_PRINT);
        $skillsList = implode(', ', $sortedSkills);
        $previousContext = $this->buildPreviousContext($previousBullets);

        return <<<PROMPT
You are an expert resume writer specializing in professional work experience. Generate tailored bullet points for ONE specific work experience item.

JOB ANALYSIS:
{$analysisJson}

WORK EXPERIENCE TO WRITE BULLETS FOR: {$itemLabel}
Relevant Skills to highlight: [{$skillsList}]
Full Description: {$itemDescription}
{$previousContext}
Respond with a JSON object:
{
  "bullets": ["bullet point 1", "bullet point 2", "bullet point 3"]
}

Rules:
- Write 3-5 bullet points. Fewer only if the item genuinely lacks relevant content.
- Each bullet MUST start with a strong action verb (Built, Designed, Led, Implemented, Optimized, Developed, Architected, etc.).
- Focus on role-specific achievements, impact on the team or organization, and professional responsibilities.
- Quantify impact where the description supports it (team size, percentage improvements, revenue/cost figures). Do NOT fabricate numbers or metrics.
- Frame bullets from the perspective of a professional employee describing their role contributions.
- ONLY reference skills from the "Relevant Skills" list above. Do NOT mention other skills.
- Each bullet should be 1-2 lines. Be concise and specific.
- Use ONLY information from the description provided. Do NOT invent accomplishments or facts.
- Do NOT repeat themes, accomplishments, or phrasing from the PREVIOUSLY GENERATED BULLETS above. Each item must contribute unique value to the resume.

Respond ONLY with the JSON object, no additional text.
PROMPT;
    }

    public function projectBullets(array $jobAnalysis, string $itemLabel, string $itemDescription, array $sortedSkills, array $previousBullets): string
    {
        $analysisJson = json_encode($jobAnalysis, JSON_PRETTY_PRINT);
        $skillsList = implode(', ', $sortedSkills);
        $previousContext = $this->buildPreviousContext($previousBullets);

        return <<<PROMPT
You are an expert resume writer specializing in technical projects and portfolio work. Generate tailored bullet points for ONE specific project.

JOB ANALYSIS:
{$analysisJson}

PROJECT TO WRITE BULLETS FOR: {$itemLabel}
Relevant Skills to highlight: [{$skillsList}]
Full Description: {$itemDescription}
{$previousContext}
Respond with a JSON object:
{
  "bullets": ["bullet point 1", "bullet point 2", "bullet point 3"]
}

Rules:
- Write 3-5 bullet points. Fewer only if the project genuinely lacks relevant content.
- Each bullet MUST start with a strong action verb (Built, Designed, Developed, Implemented, Engineered, Architected, etc.).
- Focus on what was built, the technical implementation approach, technologies used, and tangible outcomes.
- Emphasize technical decisions, architecture choices, and the problem being solved.
- If the project has users or adoption metrics mentioned in the description, include them. Do NOT fabricate numbers or metrics.
- ONLY reference skills from the "Relevant Skills" list above. Do NOT mention other skills.
- Each bullet should be 1-2 lines. Be concise and specific.
- Use ONLY information from the description provided. Do NOT invent accomplishments or facts.
- Do NOT repeat themes, accomplishments, or phrasing from the PREVIOUSLY GENERATED BULLETS above. Each item must contribute unique value to the resume.

Respond ONLY with the JSON object, no additional text.
PROMPT;
    }

    private function buildPreviousContext(array $previousBullets): string
    {
        if (empty($previousBullets)) {
            return '';
        }

        $context = "\nPREVIOUSLY GENERATED BULLETS (for other resume items — do NOT repeat these themes or accomplishments):\n";
        foreach ($previousBullets as $key => $bullets) {
            $context .= "[{$key}]\n";
            foreach ($bullets as $bullet) {
                $context .= "- {$bullet}\n";
            }
        }
        return $context;
    }

    public function objective(array $jobAnalysis, array $allBullets, int $yearsOfExperience): string
    {
        $analysisJson = json_encode($jobAnalysis, JSON_PRETTY_PRINT);

        $bulletsContext = '';
        foreach ($allBullets as $key => $bullets) {
            $bulletsContext .= "[{$key}]\n";
            foreach ($bullets as $bullet) {
                $bulletsContext .= "- {$bullet}\n";
            }
        }

        $employmentType = $jobAnalysis['employment_type'] ?? 'Full-time';

        return <<<PROMPT
You are an expert resume writer. Generate a concise resume objective statement.

JOB ANALYSIS:
{$analysisJson}

CANDIDATE'S GENERATED BULLETS:
{$bulletsContext}

CANDIDATE'S TOTAL YEARS OF EXPERIENCE: {$yearsOfExperience}

Respond with a JSON object:
{
  "objective": "the objective statement"
}

Rules:
- The objective MUST follow this exact format: "{Role name} with {X}+ years of experience in {Y}, seeking a {employment_type} {Z} role."
- {Role name} = the role title that best describes the candidate based on their experience and the target job
- {X} = use the provided years of experience number ({$yearsOfExperience})
- {Y} = the primary domain/field of expertise, inferred from the bullets
- {employment_type} = "{$employmentType}" (from the job analysis)
- {Z} = the target role type from the job description
- Keep it to ONE sentence only. No additional text.
- Do NOT start with "I" — write in implied first person.

Respond ONLY with the JSON object, no additional text.
PROMPT;
    }

    public function atsCheck(array $jobAnalysis, array $allBullets, string $objective): string
    {
        $analysisJson = json_encode($jobAnalysis, JSON_PRETTY_PRINT);

        $bulletsContext = '';
        foreach ($allBullets as $key => $bullets) {
            $bulletsContext .= "[{$key}]\n";
            foreach ($bullets as $bullet) {
                $bulletsContext .= "- {$bullet}\n";
            }
        }

        return <<<PROMPT
You are an ATS (Applicant Tracking System) optimization expert. Compare the generated resume content against the job description requirements and identify keyword gaps.

JOB ANALYSIS:
{$analysisJson}

GENERATED RESUME CONTENT:

Objective:
{$objective}

Bullet Points:
{$bulletsContext}

Perform these tasks:
1. List all important keywords/phrases from the job analysis (both required and preferred skills, plus key technical terms from responsibilities).
2. Check which of these keywords appear (exactly or as close synonyms) in the generated resume content.
3. Identify missing critical keywords.
4. For each missing keyword, suggest specifically where and how it could be naturally incorporated.

Respond with a JSON object:
{
  "matched_keywords": ["keyword1", "keyword2"],
  "missing_keywords": ["keyword3", "keyword4"],
  "keyword_coverage_pct": 75,
  "suggestions": [
    {
      "keyword": "keyword3",
      "suggestion": "Specific suggestion on where to add this keyword."
    }
  ]
}

Rules:
- keyword_coverage_pct = (matched count / total important keywords) * 100, rounded to the nearest integer.
- Only flag keywords as missing if they are genuinely important for ATS screening.
- Accept close synonyms as matches (e.g., "CI/CD" matches "continuous integration").
- Suggestions must reference a specific item or the objective and explain how to incorporate the keyword naturally.
- Do NOT suggest adding keywords the candidate has no evidence of possessing based on their bullets.

Respond ONLY with the JSON object, no additional text.
PROMPT;
    }
}
