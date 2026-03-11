<?php

class GenerateController
{
    private Experience $experienceModel;
    private Project $projectModel;
    private OllamaService $ollama;

    public function __construct()
    {
        $this->experienceModel = new Experience();
        $this->projectModel = new Project();
        $this->ollama = new OllamaService();
    }

    // ── Step 1: Analyze the job description ──

    public function analyzeJob(): void
    {
        $data = json_decode(file_get_contents('php://input'), true);

        if (empty($data['job_description'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing job_description']);
            return;
        }

        $prompt = $this->buildAnalyzePrompt($data['job_description']);

        try {
            $result = $this->ollama->generate($prompt);
            echo json_encode(['success' => true, 'job_analysis' => $result]);
        } catch (RuntimeException $e) {
            http_response_code(502);
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    // ── Step 2: Score, sort, and filter skills ──

    public function scoreItems(): void
    {
        $data = json_decode(file_get_contents('php://input'), true);

        if (empty($data['job_analysis'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing job_analysis']);
            return;
        }

        $experienceIds = $data['experience_ids'] ?? [];
        $projectIds = $data['project_ids'] ?? [];

        if (empty($experienceIds) && empty($projectIds)) {
            http_response_code(400);
            echo json_encode(['error' => 'Select at least one experience or project']);
            return;
        }

        $experiences = $this->experienceModel->getByIds(array_map('intval', $experienceIds));
        $projects = $this->projectModel->getByIds(array_map('intval', $projectIds));

        $prompt = $this->buildScorePrompt($data['job_analysis'], $experiences, $projects);

        try {
            $result = $this->ollama->generate($prompt);
            $rankedItems = $this->mergeScoresWithRecords($result['scored_items'] ?? [], $experiences, $projects);
            echo json_encode(['success' => true, 'ranked_items' => $rankedItems]);
        } catch (RuntimeException $e) {
            http_response_code(502);
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    // ── Step 3: Generate bullets for a single item ──

    public function generateBullets(): void
    {
        $data = json_decode(file_get_contents('php://input'), true);

        if (empty($data['job_analysis']) || empty($data['item'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing job_analysis or item']);
            return;
        }

        $item = $data['item'];
        $prompt = $this->buildBulletsPrompt($data['job_analysis'], $item);

        try {
            $result = $this->ollama->generate($prompt);
            $prefix = $item['type'] === 'experience' ? 'exp' : 'proj';
            echo json_encode([
                'success' => true,
                'item_key' => "{$prefix}_{$item['id']}",
                'bullets' => $result['bullets'] ?? [],
            ]);
        } catch (RuntimeException $e) {
            http_response_code(502);
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    // ── Step 4: Generate professional summary ──

    public function generateSummary(): void
    {
        $data = json_decode(file_get_contents('php://input'), true);

        if (empty($data['job_analysis']) || empty($data['all_bullets'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing job_analysis or all_bullets']);
            return;
        }

        $prompt = $this->buildSummaryPrompt($data['job_analysis'], $data['all_bullets']);

        try {
            $result = $this->ollama->generate($prompt);
            echo json_encode([
                'success' => true,
                'professional_summary' => $result['professional_summary'] ?? '',
            ]);
        } catch (RuntimeException $e) {
            http_response_code(502);
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    // ── Auto-select (unchanged) ──

    public function autoSelect(): void
    {
        $data = json_decode(file_get_contents('php://input'), true);

        if (empty($data['job_description'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing job_description']);
            return;
        }

        $experiences = $this->experienceModel->getAll();
        $projects = $this->projectModel->getAll();

        if (empty($experiences) && empty($projects)) {
            echo json_encode(['experience_ids' => [], 'project_ids' => []]);
            return;
        }

        $prompt = $this->buildAutoSelectPrompt($data['job_description'], $experiences, $projects);

        try {
            $result = $this->ollama->generate($prompt);
            echo json_encode([
                'success' => true,
                'experience_ids' => $result['experience_ids'] ?? [],
                'project_ids' => $result['project_ids'] ?? [],
                'reasoning' => $result['reasoning'] ?? '',
            ]);
        } catch (RuntimeException $e) {
            http_response_code(502);
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    // ── Prompt Builders ──

    private function buildAnalyzePrompt(string $jobDescription): string
    {
        return <<<PROMPT
You are a career strategist. Analyze the following job description and extract structured information.

JOB DESCRIPTION:
$jobDescription

Think carefully about what this role truly requires. Distinguish between explicitly stated requirements and implied ones.

Respond with a JSON object:
{
  "key_requirements": ["list of core job responsibilities and requirements"],
  "must_have_skills": ["list of explicitly required technical and soft skills"],
  "nice_to_have_skills": ["list of preferred or bonus skills mentioned"],
  "role_focus_areas": ["main focus areas, e.g. 'backend development', 'team leadership'"],
  "seniority_level": "Junior|Mid|Senior|Lead|Staff|Principal"
}

Rules:
- Only extract what the job description actually states or strongly implies.
- Do not infer skills that are not mentioned or clearly implied.
- Be precise with skill names — use the exact terminology from the job description.
- If no nice-to-have skills are mentioned, return an empty array.

Respond ONLY with the JSON object.
PROMPT;
    }

    private function buildScorePrompt(array $jobAnalysis, array $experiences, array $projects): string
    {
        $analysisJson = json_encode($jobAnalysis, JSON_PRETTY_PRINT);

        $prompt = <<<PROMPT
You are a resume strategist. Given a structured job analysis and a candidate's experiences and projects, evaluate each item's relevance and filter its skills.

JOB ANALYSIS:
$analysisJson

CANDIDATE ITEMS:
PROMPT;

        foreach ($experiences as $exp) {
            $skills = implode(', ', $exp['skills']);
            $endDate = $exp['end_date'] ?? 'Present';
            $prompt .= "\n[KEY: exp_{$exp['id']}] {$exp['title']} at {$exp['company']} ({$exp['start_date']} to {$endDate})\nSkills: {$skills}\nDescription: {$exp['description']}\n";
        }

        foreach ($projects as $proj) {
            $skills = implode(', ', $proj['skills']);
            $prompt .= "\n[KEY: proj_{$proj['id']}] {$proj['name']}\nSkills: {$skills}\nDescription: {$proj['description']}\n";
        }

        $prompt .= <<<PROMPT

For each item, think step by step:
1. What specific aspects of this item connect to the job's key requirements?
2. Rate relevance 0-100 (0 = no connection, 100 = perfect match).
3. Which of this item's skills are actually relevant to the target job? List ONLY the relevant ones, sorted from most to least relevant. Drop irrelevant skills entirely — do not include them.

Respond with a JSON object:
{
  "scored_items": [
    {
      "key": "exp_3",
      "relevance_score": 92,
      "relevant_skills": ["Python", "AWS"]
    }
  ]
}

Rules:
- Sort the scored_items array from highest to lowest relevance_score.
- Use the exact KEY values provided (e.g., "exp_3", "proj_2").
- If an item has zero relevant skills, still include it with an empty relevant_skills array.
- Be honest about scores — a 50 is mediocre relevance, not "somewhat related".

Respond ONLY with the JSON object.
PROMPT;

        return $prompt;
    }

    private function buildBulletsPrompt(array $jobAnalysis, array $item): string
    {
        $analysisJson = json_encode($jobAnalysis, JSON_PRETTY_PRINT);
        $relevantSkills = implode(', ', $item['relevant_skills'] ?? []);

        $itemHeader = $item['type'] === 'experience'
            ? "{$item['title']} at {$item['company']} ({$item['start_date']} to " . ($item['end_date'] ?? 'Present') . ")"
            : $item['name'];

        $description = $item['description'] ?? '';

        return <<<PROMPT
You are an expert resume writer. Generate tailored bullet points for ONE specific resume item.

JOB ANALYSIS:
$analysisJson

ITEM TO WRITE BULLETS FOR:
$itemHeader
Relevant Skills (ONLY use these): $relevantSkills
Full Description: $description

Think step by step:
1. Read the job analysis — what does the hiring manager care about?
2. Read this item's description — what did the candidate actually do?
3. Where do these overlap? Write bullets ONLY about the overlap.
4. If only 2 things are genuinely relevant, write 2 bullets — not 5 padded ones.

Respond with a JSON object:
{
  "bullets": ["bullet point 1", "bullet point 2"]
}

Rules:
- Write 2-5 bullet points. More only if genuinely warranted by relevance.
- Each bullet MUST start with a strong action verb (Built, Designed, Led, Implemented, etc.).
- Only reference skills from the "Relevant Skills" list above. Do NOT mention other skills.
- Include measurable outcomes ONLY where the description supports them. Do NOT fabricate numbers.
- Each bullet should be 1-2 lines. Be concise and specific.
- Use only information from the description. Do not invent accomplishments.

Respond ONLY with the JSON object.
PROMPT;
    }

    private function buildSummaryPrompt(array $jobAnalysis, array $allBullets): string
    {
        $analysisJson = json_encode($jobAnalysis, JSON_PRETTY_PRINT);

        $bulletsText = '';
        foreach ($allBullets as $key => $bullets) {
            $bulletsText .= "\n[$key]:\n";
            foreach ($bullets as $bullet) {
                $bulletsText .= "- $bullet\n";
            }
        }

        return <<<PROMPT
You are an expert resume writer. Write a professional summary paragraph for a resume tailored to a specific job.

JOB ANALYSIS:
$analysisJson

CANDIDATE'S TAILORED RESUME BULLETS (already generated for this application):
$bulletsText

Think step by step:
1. What does this job need? (from the job analysis)
2. What has this candidate demonstrated? (from the bullets above)
3. Write a summary that bridges the two — positioning the candidate as a strong fit.

Respond with a JSON object:
{
  "professional_summary": "A 3-4 sentence paragraph..."
}

Rules:
- The summary must reflect ONLY what's evidenced by the bullets above. Do not claim experience not shown.
- Position the candidate specifically for THIS role — not a generic summary.
- Mention the most relevant skills and achievements from the bullets.
- Keep it to 3-4 sentences. Every sentence must add value.

Respond ONLY with the JSON object.
PROMPT;
    }

    private function buildAutoSelectPrompt(string $jobDescription, array $experiences, array $projects): string
    {
        $prompt = <<<PROMPT
You are a career strategist. Your task is to analyze a TARGET JOB DESCRIPTION and decide which of the candidate's experiences and projects are GENUINELY relevant and should appear on a tailored resume.

Think step by step:
1. First, identify the key requirements, skills, and themes in the job description.
2. For each experience/project, assess whether it has REAL overlap with those requirements.
3. Be STRICT — only select items that would genuinely strengthen the application. If an item has no meaningful connection to the target role, do NOT include it. An irrelevant item on a resume is worse than a gap.
4. It is perfectly acceptable to select NONE if nothing is relevant.

Respond with a JSON object:
{
  "reasoning": "Brief explanation of what the job needs and why you selected/rejected each item.",
  "experience_ids": [list of selected experience IDs as integers],
  "project_ids": [list of selected project IDs as integers]
}

TARGET JOB DESCRIPTION:
$jobDescription

PROMPT;

        if (!empty($experiences)) {
            $prompt .= "\nCANDIDATE EXPERIENCES:\n";
            foreach ($experiences as $exp) {
                $skills = implode(', ', $exp['skills']);
                $endDate = $exp['end_date'] ?? 'Present';
                $prompt .= "\n[ID: {$exp['id']}] {$exp['title']} at {$exp['company']} ({$exp['start_date']} to {$endDate})\nSkills: {$skills}\nDescription: {$exp['description']}\n";
            }
        }

        if (!empty($projects)) {
            $prompt .= "\nCANDIDATE PROJECTS:\n";
            foreach ($projects as $proj) {
                $skills = implode(', ', $proj['skills']);
                $prompt .= "\n[ID: {$proj['id']}] {$proj['name']}\nSkills: {$skills}\nDescription: {$proj['description']}\n";
            }
        }

        $prompt .= "\nRespond ONLY with the JSON object.";

        return $prompt;
    }

    // ── Helpers ──

    private function mergeScoresWithRecords(array $scoredItems, array $experiences, array $projects): array
    {
        $expMap = [];
        foreach ($experiences as $exp) {
            $expMap["exp_{$exp['id']}"] = $exp;
        }

        $projMap = [];
        foreach ($projects as $proj) {
            $projMap["proj_{$proj['id']}"] = $proj;
        }

        $ranked = [];
        foreach ($scoredItems as $scored) {
            $key = $scored['key'] ?? '';
            $record = $expMap[$key] ?? $projMap[$key] ?? null;
            if (!$record) continue;

            $isExp = str_starts_with($key, 'exp_');
            $merged = [
                'type' => $isExp ? 'experience' : 'project',
                'id' => $record['id'],
                'relevance_score' => $scored['relevance_score'] ?? 0,
                'relevant_skills' => $scored['relevant_skills'] ?? [],
                'description' => $record['description'],
            ];

            if ($isExp) {
                $merged['title'] = $record['title'];
                $merged['company'] = $record['company'];
                $merged['start_date'] = $record['start_date'];
                $merged['end_date'] = $record['end_date'];
            } else {
                $merged['name'] = $record['name'];
                $merged['url'] = $record['url'] ?? null;
            }

            $ranked[] = $merged;
        }

        usort($ranked, fn($a, $b) => ($b['relevance_score'] ?? 0) - ($a['relevance_score'] ?? 0));

        return $ranked;
    }
}
