<?php

class LatexBuilder
{
    public function build(array $data): string
    {
        $lines = [];
        $lines[] = $this->buildPreamble($data);
        $lines[] = '\begin{document}';
        $lines[] = '';
        $lines[] = $this->buildObjective($data);
        $lines[] = $this->buildEducation($data);
        $lines[] = $this->buildSkills($data);
        $lines[] = $this->buildExperience($data);
        $lines[] = $this->buildProjects($data);
        $lines[] = $this->buildTestimonials($data);
        $lines[] = $this->buildLanguages($data);
        $lines[] = '';
        $lines[] = '\end{document}';

        return implode("\n", $lines);
    }

    public function escapeLatex(string $text): string
    {
        $replacements = [
            '\\' => '\textbackslash{}',
            '&'  => '\&',
            '%'  => '\%',
            '$'  => '\$',
            '#'  => '\#',
            '_'  => '\_',
            '{'  => '\{',
            '}'  => '\}',
            '~'  => '\textasciitilde{}',
            '^'  => '\textasciicircum{}',
        ];

        return strtr($text, $replacements);
    }

    private function buildPreamble(array $data): string
    {
        $personal = $data['personal'] ?? [];

        $name = $this->escapeLatex($personal['full_name'] ?? 'Your Name');

        $addressParts = [];
        if (!empty($personal['phone'])) {
            $addressParts[] = $this->escapeLatex($personal['phone']);
        }
        if (!empty($personal['location'])) {
            $addressParts[] = $this->escapeLatex($personal['location']);
        }
        $addressLine1 = implode(' \\\\ ', $addressParts);

        $contactParts = [];
        if (!empty($personal['email'])) {
            $email = $personal['email'];
            $contactParts[] = '\href{mailto:' . $this->escapeLatex($email) . '}{' . $this->escapeLatex($email) . '}';
        }
        if (!empty($personal['linkedin'])) {
            $linkedin = $personal['linkedin'];
            $displayLinkedin = preg_replace('#^https?://#', '', $linkedin);
            $contactParts[] = '\href{' . $this->escapeLatex($linkedin) . '}{' . $this->escapeLatex($displayLinkedin) . '}';
        }
        if (!empty($personal['portfolio'])) {
            $portfolio = $personal['portfolio'];
            $displayPortfolio = preg_replace('#^https?://#', '', $portfolio);
            $contactParts[] = '\href{' . $this->escapeLatex($portfolio) . '}{' . $this->escapeLatex($displayPortfolio) . '}';
        }
        $addressLine2 = implode(' \\\\ ', $contactParts);

        $lines = [];
        $lines[] = '\documentclass{resume}';
        $lines[] = '';
        $lines[] = '\usepackage[left=0.4in,top=0.4in,right=0.4in,bottom=0.4in]{geometry}';
        $lines[] = '\usepackage{needspace}';
        $lines[] = '\newcommand{\tab}[1]{\hspace{.2667\textwidth}\rlap{#1}}';
        $lines[] = '\newcommand{\itab}[1]{\hspace{0em}\rlap{#1}}';
        $lines[] = '\name{' . $name . '}';

        if ($addressLine1) {
            $lines[] = '\address{' . $addressLine1 . '}';
        }
        if ($addressLine2) {
            $lines[] = '\address{' . $addressLine2 . '}';
        }

        return implode("\n", $lines);
    }

    private function buildObjective(array $data): string
    {
        $objective = $data['objective'] ?? '';
        if (empty($objective)) return '';

        $lines = [];
        $lines[] = '\begin{rSection}{OBJECTIVE}';
        $lines[] = '';
        $lines[] = '{' . $this->escapeLatex($objective) . '}';
        $lines[] = '';
        $lines[] = '\end{rSection}';

        return implode("\n", $lines);
    }

    private function buildEducation(array $data): string
    {
        $education = $data['education'] ?? [];
        if (empty($education)) return '';

        $lines = [];
        $lines[] = '\begin{rSection}{Education}';
        $lines[] = '';

        foreach ($education as $edu) {
            $degree = $this->escapeLatex($edu['degree'] ?? '');
            $school = $this->escapeLatex($edu['school'] ?? '');

            $startDate = $this->formatDate($edu['start_date'] ?? '');
            $endDate = !empty($edu['end_date']) ? $this->formatDate($edu['end_date']) : 'Present';

            $lines[] = '{\bf ' . $degree . '} \hfill {' . $startDate . ' - ' . $endDate . '}\\\\' . $school . '\\\\';
        }

        $lines[] = '';
        $lines[] = '\end{rSection}';

        return implode("\n", $lines);
    }

    private function buildSkills(array $data): string
    {
        $skills = $data['skills'] ?? [];
        if (empty($skills)) return '';

        $escapedSkills = array_map([$this, 'escapeLatex'], $skills);
        $skillList = implode(', ', $escapedSkills);

        $lines = [];
        $lines[] = '\begin{rSection}{SKILLS}';
        $lines[] = '';
        $lines[] = '\begin{tabular}{ @{} >{\bfseries}l @{\hspace{6ex}} p{0.75\textwidth} }';
        $lines[] = 'Technical Skills & ' . $skillList . '\\\\';
        $lines[] = '\end{tabular}\\\\';
        $lines[] = '\end{rSection}';

        return implode("\n", $lines);
    }

    private function buildExperience(array $data): string
    {
        $experiences = $data['experiences'] ?? [];
        if (empty($experiences)) return '';

        $lines = [];
        $lines[] = '\begin{rSection}{EXPERIENCE}';
        $lines[] = '';

        foreach ($experiences as $exp) {
            $item = $exp['item'] ?? [];
            $title = $this->escapeLatex($item['title'] ?? '');
            $company = $this->escapeLatex($item['company'] ?? '');
            $startDate = $this->formatDate($item['start_date'] ?? '');
            $endDate = !empty($item['end_date']) ? $this->formatDate($item['end_date']) : 'Present';

            $lines[] = '\needspace{4\baselineskip}';
            $lines[] = '\textbf{' . $title . '} \hfill ' . $startDate . ' - ' . $endDate . '\\\\';
            $lines[] = $company;
            $lines[] = ' \begin{itemize}';
            $lines[] = '    \itemsep -3pt {}';

            $bullets = $exp['bullets'] ?? [];
            foreach ($bullets as $bullet) {
                $lines[] = '     \item ' . $this->escapeLatex($bullet);
            }

            $lines[] = ' \end{itemize}';
            $lines[] = '';
        }

        $lines[] = '\end{rSection}';

        return implode("\n", $lines);
    }

    private function buildProjects(array $data): string
    {
        $projects = $data['projects'] ?? [];
        if (empty($projects)) return '';

        $lines = [];
        $lines[] = '\begin{rSection}{PROJECTS}';
        $lines[] = '';

        foreach ($projects as $proj) {
            $item = $proj['item'] ?? [];
            $name = $this->escapeLatex($item['name'] ?? '');

            $lines[] = '\needspace{4\baselineskip}';
            $url = $item['url'] ?? '';
            if ($url) {
                $lines[] = '\textbf{' . $name . '} \href{' . $this->escapeLatex($url) . '}{(Link)}';
            } else {
                $lines[] = '\textbf{' . $name . '}';
            }
            $lines[] = ' \begin{itemize}';
            $lines[] = '    \itemsep -3pt {}';

            $bullets = $proj['bullets'] ?? [];
            foreach ($bullets as $bullet) {
                $lines[] = '     \item ' . $this->escapeLatex($bullet);
            }

            $lines[] = ' \end{itemize}';
            $lines[] = '';
        }

        $lines[] = '\end{rSection}';

        return implode("\n", $lines);
    }

    private function buildTestimonials(array $data): string
    {
        $testimonials = $data['testimonials'] ?? [];
        if (empty($testimonials)) return '';

        $lines = [];
        $lines[] = '\begin{rSection}{Testimonials}';
        $lines[] = '\begin{itemize}';
        $lines[] = '    \itemsep -3pt {}';

        foreach (array_reverse($testimonials) as $t) {
            $message = $this->escapeLatex($t['message'] ?? '');
            $name = $this->escapeLatex($t['name'] ?? '');

            $attribution = $name;
            if (!empty($t['position'])) {
                $attribution .= ', ' . $this->escapeLatex($t['position']);
            }
            if (!empty($t['company'])) {
                $attribution .= ' at ' . $this->escapeLatex($t['company']);
            }

            $line = '    \item ``' . $message . "'' \\newline --- " . $attribution;

            if (!empty($t['linkedin'])) {
                $line .= ' \href{' . $this->escapeLatex($t['linkedin']) . '}{(LinkedIn)}';
            }

            $lines[] = $line;
        }

        $lines[] = '\end{itemize}';
        $lines[] = '\end{rSection}';

        return implode("\n", $lines);
    }

    private function buildLanguages(array $data): string
    {
        $languages = $data['languages'] ?? [];
        if (empty($languages)) return '';

        $parts = [];
        foreach ($languages as $lang) {
            $name = $this->escapeLatex($lang['language'] ?? '');
            $proficiency = $this->escapeLatex($lang['proficiency'] ?? '');
            if ($name) {
                $parts[] = $proficiency ? "$name ($proficiency)" : $name;
            }
        }

        if (empty($parts)) return '';

        $lines = [];
        $lines[] = '\begin{rSection}{Languages}';
        $lines[] = implode(', ', $parts);
        $lines[] = '\end{rSection}';

        return implode("\n", $lines);
    }

    private function formatDate(string $date): string
    {
        if (empty($date)) return '';
        $ts = strtotime($date);
        if ($ts === false) return $this->escapeLatex($date);
        return date('M Y', $ts);
    }
}
