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
];
