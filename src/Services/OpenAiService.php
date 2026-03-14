<?php

class OpenAiService implements AiServiceInterface
{
    private string $apiKey;
    private string $model;
    private int $timeout;

    public function __construct()
    {
        $this->apiKey = $_ENV['OPENAI_API_KEY'] ?? '';
        $this->model = Config::get('ai.openai.model', 'gpt-4o');
        $this->timeout = Config::get('ai.openai.timeout', 120);
    }

    public function generate(string $prompt): array
    {
        if (empty($this->apiKey)) {
            throw new AiException('OpenAI API key not configured', [
                'type' => 'connection_error',
                'provider' => 'openai',
                'model' => $this->model,
                'http_code' => null,
                'raw_response' => null,
                'endpoint' => 'https://api.openai.com/v1/chat/completions',
            ]);
        }

        $endpoint = 'https://api.openai.com/v1/chat/completions';

        $payload = json_encode([
            'model' => $this->model,
            'messages' => [
                ['role' => 'user', 'content' => $prompt],
            ],
            'response_format' => ['type' => 'json_object'],
        ]);

        $ch = curl_init($endpoint);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $this->apiKey,
            ],
            CURLOPT_TIMEOUT => $this->timeout,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($response === false) {
            throw new AiException('OpenAI request failed: ' . $error, [
                'type' => 'connection_error',
                'provider' => 'openai',
                'model' => $this->model,
                'http_code' => null,
                'raw_response' => null,
                'endpoint' => $endpoint,
            ]);
        }

        if ($httpCode !== 200) {
            throw new AiException('OpenAI returned HTTP ' . $httpCode . ': ' . $response, [
                'type' => 'http_error',
                'provider' => 'openai',
                'model' => $this->model,
                'http_code' => $httpCode,
                'raw_response' => $response,
                'endpoint' => $endpoint,
            ]);
        }

        $decoded = json_decode($response, true);
        $content = $decoded['choices'][0]['message']['content'] ?? null;

        if ($content === null) {
            throw new AiException('Invalid OpenAI response format', [
                'type' => 'format_error',
                'provider' => 'openai',
                'model' => $this->model,
                'http_code' => $httpCode,
                'raw_response' => $response,
                'endpoint' => $endpoint,
            ]);
        }

        $result = json_decode($content, true);
        if ($result === null) {
            throw new AiException('OpenAI did not return valid JSON', [
                'type' => 'invalid_json',
                'provider' => 'openai',
                'model' => $this->model,
                'http_code' => $httpCode,
                'raw_response' => $content,
                'endpoint' => $endpoint,
            ]);
        }

        return $result;
    }
}
