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

    public function generate(): void
    {
        $data = json_decode(file_get_contents('php://input'), true);

        if (empty($data['job_description'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing job_description']);
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

        $prompt = $this->buildPrompt($data['job_description'], $experiences, $projects);

        try {
            $result = $this->ollama->generate($prompt);
            echo json_encode(['success' => true, 'data' => $result]);
        } catch (RuntimeException $e) {
            http_response_code(502);
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    private function buildPrompt(string $jobDescription, array $experiences, array $projects): string
    {
        $prompt = <<<PROMPT
You are an expert resume writer. Given a TARGET JOB DESCRIPTION and the candidate's work experience and projects, generate tailored content for their resume.

Generate a JSON object with this exact structure:
{
  "items": {
    "exp_<id>": ["bullet point 1", "bullet point 2", ...],
    "proj_<id>": ["bullet point 1", "bullet point 2", ...]
  },
  "professional_summary": "A 3-4 sentence professional summary paragraph tailored to the target role."
}

Rules:
- For each experience/project, write 3-5 concise bullet points that highlight relevance to the target job.
- Start each bullet with a strong action verb.
- Include measurable outcomes where possible.
- The professional summary should position the candidate as an ideal fit for the target role.
- Use only the information provided — do not invent facts.

TARGET JOB DESCRIPTION:
$jobDescription

PROMPT;

        if (!empty($experiences)) {
            $prompt .= "\nCANDIDATE WORK EXPERIENCE:\n";
            foreach ($experiences as $exp) {
                $skills = implode(', ', $exp['skills']);
                $endDate = $exp['end_date'] ?? 'Present';
                $prompt .= <<<EXP

[ID: exp_{$exp['id']}]
Company: {$exp['company']}
Title: {$exp['title']}
Period: {$exp['start_date']} to {$endDate}
Skills: {$skills}
Description: {$exp['description']}

EXP;
            }
        }

        if (!empty($projects)) {
            $prompt .= "\nCANDIDATE PROJECTS:\n";
            foreach ($projects as $proj) {
                $skills = implode(', ', $proj['skills']);
                $url = $proj['url'] ? "URL: {$proj['url']}" : '';
                $prompt .= <<<PROJ

[ID: proj_{$proj['id']}]
Name: {$proj['name']}
Skills: {$skills}
{$url}
Description: {$proj['description']}

PROJ;
            }
        }

        $prompt .= "\nRespond ONLY with the JSON object, no additional text.";

        return $prompt;
    }
}
