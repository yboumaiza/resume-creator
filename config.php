<?php

return [
    'db' => [
        'host' => 'localhost',
        'port' => 3306,
        'name' => 'resume_tool',
        'user' => 'root',
        'pass' => '',
        'charset' => 'utf8mb4',
    ],
    'ollama' => [
        'base_url' => 'http://localhost:11434',
        'model' => 'llama3',
        'timeout' => 120,
    ],
    'ai' => [
        'default_provider' => 'ollama',
        'openai'    => ['model' => 'gpt-5.4', 'timeout' => 120],
        'anthropic' => ['model' => 'claude-haiku-4.5', 'max_tokens' => 4096, 'timeout' => 120],
        'gemini'    => ['model' => 'gemini-3.1-flash-lite-preview', 'timeout' => 120],
    ],
];
