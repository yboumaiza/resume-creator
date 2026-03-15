<?php

class SelectionController
{
    private Experience $experienceModel;
    private Project $projectModel;
    private Testimonial $testimonialModel;
    private AiServiceInterface $ai;
    private PromptBuilder $prompts;
    private ?array $requestData = null;

    public function __construct()
    {
        $this->experienceModel = new Experience();
        $this->projectModel = new Project();
        $this->testimonialModel = new Testimonial();
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
            'unload-model'  => $this->unloadModel(),
            'auto-select'   => $this->autoSelect(),
            'analyze-jd'    => $this->analyzeJd(),
            'filter-skills' => $this->filterSkills(),
            'sort-skills'   => $this->sortSkills(),
            'bullets'       => $this->generateBullets(),
            'curate-skills' => $this->curateSkills(),
            'objective'     => $this->generateObjective(),
            'ats-check'     => $this->atsCheck(),
            'analyze-per-item' => $this->analyzePerItem(),
            'analyze-holistic' => $this->analyzeHolistic(),
            default         => $this->respondError(400, 'Invalid or missing step parameter'),
        };
    }

    public function providers(): void
    {
        $providers = AiServiceFactory::getAvailableProviders();
        echo json_encode(['success' => true, 'providers' => $providers]);
    }

    private function unloadModel(): void
    {
        if ($this->ai instanceof OllamaService) {
            $this->ai->unloadModel();
            $this->respondSuccess(['unloaded' => true]);
        } else {
            $this->respondSuccess(['unloaded' => false]);
        }
    }

    private function autoSelect(): void
    {
        $data = $this->requestData;

        if (empty($data['job_description'])) {
            $this->respondError(400, 'Missing job_description');
            return;
        }

        $experiences = $this->experienceModel->getAll();
        $projects = $this->projectModel->getAll();

        if (empty($experiences) && empty($projects)) {
            $this->respondSuccess([
                'selected_experience_ids' => [],
                'selected_project_ids' => [],
            ]);
            return;
        }

        $prompt = $this->prompts->autoSelect(
            $data['job_description'],
            $experiences,
            $projects
        );

        try {
            $result = $this->ai->generate($prompt);

            $validExpIds = array_map(fn($e) => (int) $e['id'], $experiences);
            $validProjIds = array_map(fn($p) => (int) $p['id'], $projects);

            $selectedExpIds = array_values(array_intersect(
                array_map('intval', $result['selected_experience_ids'] ?? []),
                $validExpIds
            ));
            $selectedProjIds = array_values(array_intersect(
                array_map('intval', $result['selected_project_ids'] ?? []),
                $validProjIds
            ));

            $this->respondSuccess([
                'selected_experience_ids' => $selectedExpIds,
                'selected_project_ids' => $selectedProjIds,
            ]);
        } catch (AiException $e) {
            $this->respondAiError($e);
        }
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
            $classifiedSkills = array_map(fn($s) => ['name' => $s, 'type' => 'tool', 'subcategory' => 'general'], $relevantSkills);
            $this->respondSuccess([
                'item_key' => $data['item_key'],
                'sorted_skills' => $relevantSkills,
                'classified_skills' => $classifiedSkills,
            ]);
            return;
        }

        $prompt = $this->prompts->sortSkills($data['job_analysis'], $relevantSkills);

        try {
            $result = $this->ai->generate($prompt);
            $rawSorted = $result['sorted_skills'] ?? [];

            $sortedNames = [];
            $classifiedSkills = [];

            foreach ($rawSorted as $entry) {
                if (is_array($entry) && isset($entry['name'])) {
                    $sortedNames[] = $entry['name'];
                    $classifiedSkills[] = [
                        'name' => $entry['name'],
                        'type' => in_array($entry['type'] ?? '', ['language', 'tool', 'skill']) ? $entry['type'] : 'tool',
                        'subcategory' => $entry['subcategory'] ?? 'general',
                    ];
                } elseif (is_string($entry)) {
                    $sortedNames[] = $entry;
                    $classifiedSkills[] = ['name' => $entry, 'type' => 'tool', 'subcategory' => 'general'];
                }
            }

            if (empty($sortedNames)) {
                $sortedNames = $relevantSkills;
                $classifiedSkills = array_map(fn($s) => ['name' => $s, 'type' => 'tool', 'subcategory' => 'general'], $relevantSkills);
            }

            $this->respondSuccess([
                'item_key' => $data['item_key'],
                'sorted_skills' => $sortedNames,
                'classified_skills' => $classifiedSkills,
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
        $classifiedSkills = $data['classified_skills'] ?? [];
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
                $previousBullets,
                $classifiedSkills
            );
        } elseif ($itemType === 'project') {
            $prompt = $this->prompts->projectBullets(
                $data['job_analysis'],
                $itemLabel,
                $item['description'] ?? '',
                $sortedSkills,
                $previousBullets,
                $classifiedSkills
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

    private function curateSkills(): void
    {
        $data = $this->requestData;

        if (empty($data['job_analysis']) || !isset($data['all_classified_skills'])) {
            $this->respondError(400, 'Missing job_analysis or all_classified_skills');
            return;
        }

        $allClassified = $data['all_classified_skills'];

        if (count($allClassified) <= 1) {
            $this->respondSuccess(['curated_skills' => $allClassified]);
            return;
        }

        $prompt = $this->prompts->curateSkills($data['job_analysis'], $allClassified);

        try {
            $result = $this->ai->generate($prompt);
            $rawCurated = $result['curated_skills'] ?? [];

            // Build a lookup of valid input skill names (lowercase)
            $validSkills = [];
            foreach ($allClassified as $cs) {
                $name = is_array($cs) ? ($cs['name'] ?? '') : $cs;
                $validSkills[strtolower($name)] = true;
            }

            $curatedSkills = [];
            foreach ($rawCurated as $entry) {
                if (is_array($entry) && isset($entry['name'])) {
                    if (isset($validSkills[strtolower($entry['name'])])) {
                        $curatedSkills[] = [
                            'name' => $entry['name'],
                            'type' => in_array($entry['type'] ?? '', ['language', 'tool', 'skill']) ? $entry['type'] : 'tool',
                        ];
                    }
                }
            }

            if (empty($curatedSkills)) {
                $curatedSkills = array_slice($allClassified, 0, 15);
            }

            $this->respondSuccess(['curated_skills' => $curatedSkills]);
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

        $testimonials = $this->testimonialModel->getAll();

        if (count($testimonials) > 1) {
            try {
                $sortPrompt = $this->prompts->sortTestimonials($testimonials, $data['job_analysis']);
                $sortResult = $this->ai->generate($sortPrompt);
                $sortedIndices = $sortResult['sorted_indices'] ?? [];

                if (
                    is_array($sortedIndices)
                    && count($sortedIndices) === count($testimonials)
                    && !array_diff($sortedIndices, array_keys($testimonials))
                ) {
                    $sorted = [];
                    foreach ($sortedIndices as $idx) {
                        $sorted[] = $testimonials[$idx];
                    }
                    $testimonials = $sorted;
                }
            } catch (AiException $e) {
                // Fallback: keep original order
            }
        }

        $prompt = $this->prompts->objective(
            $data['job_analysis'],
            $data['all_bullets'],
            $yearsOfExperience,
            $testimonials
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

    private function analyzePerItem(): void
    {
        $data = $this->requestData;

        if (empty($data['job_analysis']) || !isset($data['objective']) || empty($data['items']) || !isset($data['curated_skills'])) {
            $this->respondError(400, 'Missing job_analysis, objective, items, or curated_skills');
            return;
        }

        $prompt = $this->prompts->analyzePerItem(
            $data['job_analysis'],
            $data['objective'],
            $data['items'],
            $data['curated_skills']
        );

        try {
            $result = $this->ai->generate($prompt);
            $this->respondSuccess(['per_item_findings' => $result['findings'] ?? []]);
        } catch (AiException $e) {
            $this->respondAiError($e);
        }
    }

    private function analyzeHolistic(): void
    {
        $data = $this->requestData;

        if (empty($data['job_analysis']) || !isset($data['objective']) || empty($data['items']) || !isset($data['curated_skills'])) {
            $this->respondError(400, 'Missing job_analysis, objective, items, or curated_skills');
            return;
        }

        $prompt = $this->prompts->analyzeHolistic(
            $data['job_analysis'],
            $data['objective'],
            $data['items'],
            $data['curated_skills']
        );

        try {
            $result = $this->ai->generate($prompt);
            $this->respondSuccess(['holistic_findings' => $result['findings'] ?? []]);
        } catch (AiException $e) {
            $this->respondAiError($e);
        }
    }

    private function calculateYearsOfExperience(array $experiences): int
    {
        $totalMonths = 0;
        foreach ($experiences as $exp) {
            $commitment = $exp['commitment'] ?? '';
            if ($commitment === 'Freelance' || $commitment === 'Self-Employed') {
                continue;
            }
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
