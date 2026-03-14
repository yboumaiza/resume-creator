<?php

class PdfCompiler
{
    private function findPdflatex(): string
    {
        // Try bare command first (works if on PATH)
        exec('pdflatex --version 2>&1', $out, $code);
        if ($code === 0) return 'pdflatex';

        // TeX Live on Windows: C:/texlive/<year>/bin/windows/pdflatex.exe
        $glob = glob('C:/texlive/*/bin/windows/pdflatex.exe');
        if ($glob) return end($glob);

        throw new RuntimeException('pdflatex not found. Install TeX Live or add it to PATH.');
    }

    public function compile(string $texContent): string
    {
        $pdflatex = $this->findPdflatex();

        $tempDir = sys_get_temp_dir() . '/resume_' . uniqid();
        mkdir($tempDir, 0777, true);

        // Copy resume.cls into temp dir
        $base = dirname(__DIR__, 2);
        $clsSource = $base . '/resume.cls';
        if (!file_exists($clsSource)) {
            throw new RuntimeException('resume.cls not found at: ' . $clsSource);
        }
        copy($clsSource, $tempDir . '/resume.cls');

        // Write .tex file
        file_put_contents($tempDir . '/resume.tex', $texContent);

        // Run pdflatex from within the temp dir to avoid path issues
        $originalDir = getcwd();
        chdir($tempDir);

        $command = '"' . $pdflatex . '" -interaction=nonstopmode -halt-on-error resume.tex 2>&1';
        exec($command, $output, $exitCode);

        chdir($originalDir);

        $pdfPath = $tempDir . '/resume.pdf';

        if ($exitCode !== 0 || !file_exists($pdfPath)) {
            $log = implode("\n", $output);
            $this->cleanup($tempDir);
            throw new RuntimeException('pdflatex compilation failed: ' . $log);
        }

        return $pdfPath;
    }

    public function cleanup(string $tempDir): void
    {
        if (!is_dir($tempDir)) return;

        $files = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($tempDir, RecursiveDirectoryIterator::SKIP_DOTS),
            RecursiveIteratorIterator::CHILD_FIRST
        );

        foreach ($files as $file) {
            if ($file->isDir()) {
                rmdir($file->getRealPath());
            } else {
                unlink($file->getRealPath());
            }
        }

        rmdir($tempDir);
    }
}
