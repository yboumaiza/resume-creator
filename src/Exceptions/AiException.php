<?php

class AiException extends RuntimeException
{
    private array $detail;

    public function __construct(string $message, array $detail = [])
    {
        parent::__construct($message);
        $this->detail = $detail;
    }

    public function getDetail(): array
    {
        return $this->detail;
    }
}
