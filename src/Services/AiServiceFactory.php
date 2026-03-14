<?php

class AiServiceFactory
{
    public static function create(string $provider): AiServiceInterface
    {
        return match ($provider) {
            'ollama' => new OllamaService(),
            'openai' => new OpenAiService(),
            'anthropic' => new AnthropicService(),
            'gemini' => new GeminiService(),
            default => throw new AiException("Unknown AI provider: $provider", [
                'type' => 'connection_error',
                'provider' => $provider,
                'model' => null,
                'http_code' => null,
                'raw_response' => null,
                'endpoint' => null,
            ]),
        };
    }

    public static function getAvailableProviders(): array
    {
        return [
            [
                'id' => 'ollama',
                'name' => 'Ollama (Local)',
                'ready' => self::isOllamaReady(),
            ],
            [
                'id' => 'openai',
                'name' => 'OpenAI',
                'ready' => !empty($_ENV['OPENAI_API_KEY'] ?? ''),
            ],
            [
                'id' => 'anthropic',
                'name' => 'Anthropic (Claude)',
                'ready' => !empty($_ENV['ANTHROPIC_API_KEY'] ?? ''),
            ],
            [
                'id' => 'gemini',
                'name' => 'Google Gemini',
                'ready' => !empty($_ENV['GEMINI_API_KEY'] ?? ''),
            ],
        ];
    }

    private static function isOllamaReady(): bool
    {
        $baseUrl = rtrim(Config::get('ollama.base_url', 'http://localhost:11434'), '/');

        $ch = curl_init($baseUrl . '/api/tags');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 2,
            CURLOPT_CONNECTTIMEOUT => 2,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        return $response !== false && $httpCode === 200;
    }
}
