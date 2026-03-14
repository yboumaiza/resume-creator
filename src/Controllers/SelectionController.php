<?php

class SelectionController
{
    private Experience $experienceModel;
    private Project $projectModel;
    private AiServiceInterface $ai;
    private PromptBuilder $prompts;
    private ?array $requestData = null;

    public function __construct()
    {
        $this->experienceModel = new Experience();
        $this->projectModel = new Project();
        $this->prompts = new PromptBuilder();
    }

    public function generate(): void
    {
        $this->requestData = json_decode(file_get_contents('php://input'), true) ?? [];

        $provider = $this->requestData['provider']
            ?? Config::get('ai.default_provider', 'ollama');

        try {
            $this->ai = AiServiceFactory::create($provider);
        } catch (AiException $e) {
            $this->respondAiError($e);
            return;
        }

        $step = $_GET['step'] ?? '';

        match ($step) {
            'analyze-jd'    => $this->analyzeJd(),
            'filter-skills' => $this->filterSkills(),
            'sort-skills'   => $this->sortSkills(),
            'bullets'       => $this->generateBullets(),
            'objective'     => $this->generateObjective(),
            'ats-check'     => $this->atsCheck(),
            default         => $this->respondError(400, 'Invalid or missing step parameter'),
        };
    }

    public function providers(): void
    {
        $providers = AiServiceFactory::getAvailableProviders();
        echo json_encode(['success' => true, 'providers' => $providers]);
    }

    private function analyzeJd(): void
    {
        $data = $this->requestData;

        if (empty($data['job_description'])) {
            $this->respondError(400, 'Missing job_description');
            return;
        }

        $prompt = $this->prompts->analyzeJd($data['job_description']);

        try {
            $result = $this->ai->generate($prompt);
            $this->respondSuccess(['job_analysis' => $result]);
        } catch (AiException $e) {
            $this->respondAiError($e);
        }
    }

    private function filterSkills(): void
    {
        $data = $this->requestData;

        if (empty($data['job_analysis']) || empty($data['item_type']) || !isset($data['item_id'])) {
            $this->respondError(400, 'Missing job_analysis, item_type, or item_id');
            return;
        }

        $itemType = $data['item_type'];
        $itemId = (int) $data['item_id'];

        if ($itemType === 'experience') {
            $item = $this->experienceModel->getById($itemId);
            $itemLabel = ($item['title'] ?? '') . ' at ' . ($item['company'] ?? '');
        } elseif ($itemType === 'project') {
            $item = $this->projectModel->getById($itemId);
            $itemLabel = $item['name'] ?? '';
        } else {
            $this->respondError(400, 'Invalid item_type');
            return;
        }

        if (!$item) {
            $this->respondError(404, 'Item not found');
            return;
        }

        $itemKey = ($itemType === 'experience' ? 'exp_' : 'proj_') . $itemId;
        $skills = $item['skills'] ?? [];

        if (empty($skills)) {
            $this->respondSuccess([
                'item_key' => $itemKey,
                'item' => $item,
                'relevant_skills' => [],
                'relevance_score' => 0,
            ]);
            return;
        }

        $prompt = $this->prompts->filterSkills(
            $data['job_analysis'],
            $itemLabel,
            $skills,
            $item['description'] ?? ''
        );

        try {
            $result = $this->ai->generate($prompt);
            $this->respondSuccess([
                'item_key' => $itemKey,
                'item' => $item,
                'relevant_skills' => $result['relevant_skills'] ?? [],
                'relevance_score' => (int) ($result['relevance_score'] ?? 0),
            ]);
        } catch (AiException $e) {
            $this->respondAiError($e);
        }
    }

    private function sortSkills(): void
    {
        $data = $this->requestData;

        if (empty($data['job_analysis']) || !isset($data['item_key']) || !isset($data['relevant_skills'])) {
            $this->respondError(400, 'Missing job_analysis, item_key, or relevant_skills');
            return;
        }

        $relevantSkills = $data['relevant_skills'];

        if (count($relevantSkills) <= 1) {
            $this->respondSuccess([
                'item_key' => $data['item_key'],
                'sorted_skills' => $relevantSkills,
            ]);
            return;
        }

        $prompt = $this->prompts->sortSkills($data['job_analysis'], $relevantSkills);

        try {
            $result = $this->ai->generate($prompt);
            $this->respondSuccess([
                'item_key' => $data['item_key'],
                'sorted_skills' => $result['sorted_skills'] ?? $relevantSkills,
            ]);
        } catch (AiException $e) {
            $this->respondAiError($e);
        }
    }

    private function generateBullets(): void
    {
        $data = $this->requestData;

        if (empty($data['job_analysis']) || empty($data['item']) || empty($data['item_type'])) {
            $this->respondError(400, 'Missing job_analysis, item, or item_type');
            return;
        }

        $item = $data['item'];
        $itemType = $data['item_type'];
        $sortedSkills = $data['sorted_skills'] ?? [];
        $previousBullets = $data['previous_bullets'] ?? [];
        $itemKey = $data['item_key'] ?? '';

        $itemLabel = '';
        if (isset($item['title'])) {
            $itemLabel = $item['title'] . ' at ' . ($item['company'] ?? '');
        } elseif (isset($item['name'])) {
            $itemLabel = $item['name'];
        }

        if ($itemType === 'experience') {
            $prompt = $this->prompts->experienceBullets(
                $data['job_analysis'],
                $itemLabel,
                $item['description'] ?? '',
                $sortedSkills,
                $previousBullets
            );
        } elseif ($itemType === 'project') {
            $prompt = $this->prompts->projectBullets(
                $data['job_analysis'],
                $itemLabel,
                $item['description'] ?? '',
                $sortedSkills,
                $previousBullets
            );
        } else {
            $this->respondError(400, 'Invalid item_type: must be "experience" or "project"');
            return;
        }

        try {
            $result = $this->ai->generate($prompt);
            $this->respondSuccess([
                'item_key' => $itemKey,
                'bullets' => $result['bullets'] ?? [],
            ]);
        } catch (AiException $e) {
            $this->respondAiError($e);
        }
    }

    private function generateObjective(): void
    {
        $data = $this->requestData;

        if (empty($data['job_analysis']) || empty($data['all_bullets'])) {
            $this->respondError(400, 'Missing job_analysis or all_bullets');
            return;
        }

        $experienceIds = $data['experience_ids'] ?? [];
        $yearsOfExperience = 0;

        if (!empty($experienceIds)) {
            $experiences = $this->experienceModel->getByIds(array_map('intval', $experienceIds));
            $yearsOfExperience = $this->calculateYearsOfExperience($experiences);
        }

        $prompt = $this->prompts->objective(
            $data['job_analysis'],
            $data['all_bullets'],
            $yearsOfExperience
        );

        try {
            $result = $this->ai->generate($prompt);
            $this->respondSuccess([
                'objective' => $result['objective'] ?? '',
                'years_of_experience' => $yearsOfExperience,
            ]);
        } catch (AiException $e) {
            $this->respondAiError($e);
        }
    }

    private function atsCheck(): void
    {
        $data = $this->requestData;

        if (empty($data['job_analysis']) || empty($data['all_bullets']) || !isset($data['objective'])) {
            $this->respondError(400, 'Missing job_analysis, all_bullets, or objective');
            return;
        }

        $prompt = $this->prompts->atsCheck(
            $data['job_analysis'],
            $data['all_bullets'],
            $data['objective']
        );

        try {
            $result = $this->ai->generate($prompt);
            $this->respondSuccess(['ats_result' => $result]);
        } catch (AiException $e) {
            $this->respondAiError($e);
        }
    }

    private function calculateYearsOfExperience(array $experiences): int
    {
        $totalMonths = 0;
        foreach ($experiences as $exp) {
            $start = new DateTime($exp['start_date']);
            $end = $exp['end_date'] ? new DateTime($exp['end_date']) : new DateTime();
            $diff = $start->diff($end);
            $totalMonths += ($diff->y * 12) + $diff->m;
        }
        return max(1, (int) round($totalMonths / 12));
    }

    private function respondSuccess(array $data): void
    {
        echo json_encode(array_merge(['success' => true], $data));
    }

    private function respondError(int $code, string $message): void
    {
        http_response_code($code);
        echo json_encode(['error' => $message]);
    }

    private function respondAiError(AiException $e): void
    {
        http_response_code(502);
        echo json_encode([
            'error' => $e->getMessage(),
            'error_detail' => $e->getDetail(),
        ]);
    }
}
