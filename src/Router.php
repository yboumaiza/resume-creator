<?php

class Router
{
    private array $routes = [];

    public function register(string $method, string $route, array $handler): self
    {
        $this->routes[] = [
            'method' => strtoupper($method),
            'route' => $route,
            'handler' => $handler,
        ];
        return $this;
    }

    public function dispatch(string $method, string $route): void
    {
        foreach ($this->routes as $r) {
            if ($r['method'] === strtoupper($method) && $r['route'] === $route) {
                [$controller, $action] = $r['handler'];
                $instance = new $controller();
                $instance->$action();
                return;
            }
        }

        http_response_code(404);
        echo json_encode(['error' => 'Route not found']);
    }
}
