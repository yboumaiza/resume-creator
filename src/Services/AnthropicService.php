<?php

class AnthropicService implements AiServiceInterface
{
    private string $apiKey;
    private string $model;
    private int $maxTokens;
    private int $timeout;

    public function __construct()
    {
        $this->apiKey = $_ENV['ANTHROPIC_API_KEY'] ?? '';
        $this->model = Config::get('ai.anthropic.model', 'claude-sonnet-4-20250514');
        $this->maxTokens = Config::get('ai.anthropic.max_tokens', 4096);
        $this->timeout = Config::get('ai.anthropic.timeout', 120);
    }

    public function generate(string $prompt): array
    {
        if (empty($this->apiKey)) {
            throw new AiException('Anthropic API key not configured', [
                'type' => 'connection_error',
                'provider' => 'anthropic',
                'model' => $this->model,
                'http_code' => null,
                'raw_response' => null,
                'endpoint' => 'https://api.anthropic.com/v1/messages',
            ]);
        }

        $endpoint = 'https://api.anthropic.com/v1/messages';

        $payload = json_encode([
            'model' => $this->model,
            'max_tokens' => $this->maxTokens,
            'messages' => [
                ['role' => 'user', 'content' => $prompt],
            ],
        ]);

        $ch = curl_init($endpoint);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'x-api-key: ' . $this->apiKey,
                'anthropic-version: 2023-06-01',
            ],
            CURLOPT_TIMEOUT => $this->timeout,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($response === false) {
            throw new AiException('Anthropic request failed: ' . $error, [
                'type' => 'connection_error',
                'provider' => 'anthropic',
                'model' => $this->model,
                'http_code' => null,
                'raw_response' => null,
                'endpoint' => $endpoint,
            ]);
        }

        if ($httpCode !== 200) {
            throw new AiException('Anthropic returned HTTP ' . $httpCode . ': ' . $response, [
                'type' => 'http_error',
                'provider' => 'anthropic',
                'model' => $this->model,
                'http_code' => $httpCode,
                'raw_response' => $response,
                'endpoint' => $endpoint,
            ]);
        }

        $decoded = json_decode($response, true);
        $content = $decoded['content'][0]['text'] ?? null;

        if ($content === null) {
            throw new AiException('Invalid Anthropic response format', [
                'type' => 'format_error',
                'provider' => 'anthropic',
                'model' => $this->model,
                'http_code' => $httpCode,
                'raw_response' => $response,
                'endpoint' => $endpoint,
            ]);
        }

        // Strip markdown JSON fences if present
        $content = trim($content);
        if (preg_match('/^```(?:json)?\s*([\s\S]*?)\s*```$/s', $content, $matches)) {
            $content = $matches[1];
        }

        $result = json_decode($content, true);
        if ($result === null) {
            throw new AiException('Anthropic did not return valid JSON', [
                'type' => 'invalid_json',
                'provider' => 'anthropic',
                'model' => $this->model,
                'http_code' => $httpCode,
                'raw_response' => $content,
                'endpoint' => $endpoint,
            ]);
        }

        return $result;
    }
}
