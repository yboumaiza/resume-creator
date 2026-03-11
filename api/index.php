<?php

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$base = dirname(__DIR__);

require_once $base . '/src/Config.php';
Config::load($base . '/config.php');

require_once $base . '/src/Database.php';
require_once $base . '/src/Router.php';
require_once $base . '/src/Models/Experience.php';
require_once $base . '/src/Models/Project.php';
require_once $base . '/src/Services/OllamaService.php';
require_once $base . '/src/Controllers/ExperienceController.php';
require_once $base . '/src/Controllers/ProjectController.php';
require_once $base . '/src/Controllers/GenerateController.php';

$router = new Router();
$method = $_SERVER['REQUEST_METHOD'];
$route = $_GET['route'] ?? '';

$router->register('GET', 'experiences', [ExperienceController::class, 'index']);
$router->register('POST', 'experiences', [ExperienceController::class, 'store']);
$router->register('PUT', 'experiences', [ExperienceController::class, 'update']);
$router->register('DELETE', 'experiences', [ExperienceController::class, 'destroy']);

$router->register('GET', 'projects', [ProjectController::class, 'index']);
$router->register('POST', 'projects', [ProjectController::class, 'store']);
$router->register('PUT', 'projects', [ProjectController::class, 'update']);
$router->register('DELETE', 'projects', [ProjectController::class, 'destroy']);

$router->register('POST', 'generate/analyze', [GenerateController::class, 'analyzeJob']);
$router->register('POST', 'generate/score', [GenerateController::class, 'scoreItems']);
$router->register('POST', 'generate/bullets', [GenerateController::class, 'generateBullets']);
$router->register('POST', 'generate/summary', [GenerateController::class, 'generateSummary']);
$router->register('POST', 'auto-select', [GenerateController::class, 'autoSelect']);

$router->dispatch($method, $route);
