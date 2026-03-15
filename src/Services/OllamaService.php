<?php

class OllamaService implements AiServiceInterface
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

    public function unloadModel(): void
    {
        $payload = json_encode([
            'model' => $this->model,
            'keep_alive' => 0,
        ]);

        $ch = curl_init($this->baseUrl . '/api/generate');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_TIMEOUT => 5,
        ]);

        curl_exec($ch);
        curl_close($ch);
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

        $endpoint = $this->baseUrl . '/api/generate';

        if ($response === false) {
            throw new AiException('Ollama request failed: ' . $error, [
                'type' => 'connection_error',
                'provider' => 'ollama',
                'model' => $this->model,
                'http_code' => null,
                'raw_response' => null,
                'endpoint' => $endpoint,
            ]);
        }

        if ($httpCode !== 200) {
            throw new AiException('Ollama returned HTTP ' . $httpCode . ': ' . $response, [
                'type' => 'http_error',
                'provider' => 'ollama',
                'model' => $this->model,
                'http_code' => $httpCode,
                'raw_response' => $response,
                'endpoint' => $endpoint,
            ]);
        }

        $decoded = json_decode($response, true);
        if (!$decoded || !isset($decoded['response'])) {
            throw new AiException('Invalid Ollama response format', [
                'type' => 'format_error',
                'provider' => 'ollama',
                'model' => $this->model,
                'http_code' => $httpCode,
                'raw_response' => $response,
                'endpoint' => $endpoint,
            ]);
        }

        $result = json_decode($decoded['response'], true);
        if ($result === null) {
            throw new AiException('Ollama did not return valid JSON', [
                'type' => 'invalid_json',
                'provider' => 'ollama',
                'model' => $this->model,
                'http_code' => $httpCode,
                'raw_response' => $decoded['response'],
                'endpoint' => $endpoint,
            ]);
        }

        return $result;
    }
}
