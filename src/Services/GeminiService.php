<?php

class GeminiService implements AiServiceInterface
{
    private string $apiKey;
    private string $model;
    private int $timeout;

    public function __construct()
    {
        $this->apiKey = $_ENV['GEMINI_API_KEY'] ?? '';
        $this->model = Config::get('ai.gemini.model', 'gemini-2.0-flash');
        $this->timeout = Config::get('ai.gemini.timeout', 120);
    }

    public function generate(string $prompt): array
    {
        if (empty($this->apiKey)) {
            throw new AiException('Gemini API key not configured', [
                'type' => 'connection_error',
                'provider' => 'gemini',
                'model' => $this->model,
                'http_code' => null,
                'raw_response' => null,
                'endpoint' => $this->buildEndpoint(),
            ]);
        }

        $endpoint = $this->buildEndpoint();

        $payload = json_encode([
            'contents' => [
                ['parts' => [['text' => $prompt]]],
            ],
            'generationConfig' => [
                'responseMimeType' => 'application/json',
            ],
        ]);

        $ch = curl_init($endpoint);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
            ],
            CURLOPT_TIMEOUT => $this->timeout,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($response === false) {
            throw new AiException('Gemini request failed: ' . $error, [
                'type' => 'connection_error',
                'provider' => 'gemini',
                'model' => $this->model,
                'http_code' => null,
                'raw_response' => null,
                'endpoint' => $endpoint,
            ]);
        }

        if ($httpCode !== 200) {
            throw new AiException('Gemini returned HTTP ' . $httpCode . ': ' . $response, [
                'type' => 'http_error',
                'provider' => 'gemini',
                'model' => $this->model,
                'http_code' => $httpCode,
                'raw_response' => $response,
                'endpoint' => $endpoint,
            ]);
        }

        $decoded = json_decode($response, true);
        $content = $decoded['candidates'][0]['content']['parts'][0]['text'] ?? null;

        if ($content === null) {
            throw new AiException('Invalid Gemini response format', [
                'type' => 'format_error',
                'provider' => 'gemini',
                'model' => $this->model,
                'http_code' => $httpCode,
                'raw_response' => $response,
                'endpoint' => $endpoint,
            ]);
        }

        $result = json_decode($content, true);
        if ($result === null) {
            throw new AiException('Gemini did not return valid JSON', [
                'type' => 'invalid_json',
                'provider' => 'gemini',
                'model' => $this->model,
                'http_code' => $httpCode,
                'raw_response' => $content,
                'endpoint' => $endpoint,
            ]);
        }

        return $result;
    }

    private function buildEndpoint(): string
    {
        return 'https://generativelanguage.googleapis.com/v1beta/models/'
            . urlencode($this->model)
            . ':generateContent?key=' . $this->apiKey;
    }
}
