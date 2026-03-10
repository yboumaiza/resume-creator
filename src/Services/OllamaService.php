<?php

class OllamaService
{
    private string $baseUrl;
    private string $model;
    private int $timeout;

    public function __construct()
    {
        $this->baseUrl = rtrim(Config::get('ollama.base_url', 'http://localhost:11434'), '/');
        $this->model = Config::get('ollama.model', 'llama3');
        $this->timeout = Config::get('ollama.timeout', 120);
    }

    public function generate(string $prompt): array
    {
        $payload = json_encode([
            'model' => $this->model,
            'prompt' => $prompt,
            'format' => 'json',
            'stream' => false,
        ]);

        $ch = curl_init($this->baseUrl . '/api/generate');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_TIMEOUT => $this->timeout,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($response === false) {
            throw new RuntimeException('Ollama request failed: ' . $error);
        }

        if ($httpCode !== 200) {
            throw new RuntimeException('Ollama returned HTTP ' . $httpCode . ': ' . $response);
        }

        $decoded = json_decode($response, true);
        if (!$decoded || !isset($decoded['response'])) {
            throw new RuntimeException('Invalid Ollama response format');
        }

        $result = json_decode($decoded['response'], true);
        if ($result === null) {
            throw new RuntimeException('Ollama did not return valid JSON. Raw: ' . $decoded['response']);
        }

        return $result;
    }
}
