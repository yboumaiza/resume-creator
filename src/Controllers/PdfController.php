<?php

class PdfController
{
    public function generate(): void
    {
        $input = json_decode(file_get_contents('php://input'), true);

        if (!$input || !isset($input['editableResults'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing editableResults']);
            return;
        }

        $editable = $input['editableResults'];

        // Fetch DB data
        $personal = (new PersonalInfo())->get();
        $education = (new Education())->getAll();
        $testimonials = (new Testimonial())->getAll();

        // Aggregate unique skills from experiences + projects
        $skillSet = [];
        foreach (['experiences', 'projects'] as $section) {
            foreach ($editable[$section] ?? [] as $entry) {
                foreach ($entry['skills'] ?? [] as $skill) {
                    $lower = strtolower($skill);
                    if (!isset($skillSet[$lower])) {
                        $skillSet[$lower] = $skill;
                    }
                }
            }
        }

        // Build data array for LatexBuilder
        $data = [
            'personal'     => $personal ?? [],
            'objective'    => $editable['objective'] ?? '',
            'education'    => $education,
            'skills'       => array_values($skillSet),
            'experiences'  => $editable['experiences'] ?? [],
            'projects'     => $editable['projects'] ?? [],
            'testimonials' => $testimonials,
            'languages'    => $personal['languages'] ?? [],
        ];

        $builder = new LatexBuilder();
        $compiler = new PdfCompiler();

        $texContent = $builder->build($data);
        $pdfPath = null;
        $tempDir = null;

        try {
            $pdfPath = $compiler->compile($texContent);
            $tempDir = dirname($pdfPath);

            // Override Content-Type (api/index.php sets JSON by default)
            header_remove('Content-Type');
            header('Content-Type: application/pdf');
            header('Content-Disposition: attachment; filename="resume.pdf"');
            header('Content-Length: ' . filesize($pdfPath));

            readfile($pdfPath);
        } finally {
            if ($tempDir) {
                $compiler->cleanup($tempDir);
            }
        }
    }
}
