<?php

interface AiServiceInterface
{
    public function generate(string $prompt): array;
}
