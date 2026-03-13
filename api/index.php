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
require_once $base . '/src/Models/PersonalInfo.php';
require_once $base . '/src/Models/Education.php';
require_once $base . '/src/Models/Experience.php';
require_once $base . '/src/Models/Project.php';
require_once $base . '/src/Models/Testimonial.php';

require_once $base . '/src/Services/OllamaService.php';
require_once $base . '/src/Services/PromptBuilder.php';
require_once $base . '/src/Controllers/PersonalInfoController.php';
require_once $base . '/src/Controllers/EducationController.php';
require_once $base . '/src/Controllers/ExperienceController.php';
require_once $base . '/src/Controllers/ProjectController.php';
require_once $base . '/src/Controllers/TestimonialController.php';

require_once $base . '/src/Controllers/SelectionController.php';

$router = new Router();
$method = $_SERVER['REQUEST_METHOD'];
$route = $_GET['route'] ?? '';

$router->register('GET', 'personal', [PersonalInfoController::class, 'index']);
$router->register('POST', 'personal', [PersonalInfoController::class, 'store']);

$router->register('GET', 'education', [EducationController::class, 'index']);
$router->register('POST', 'education', [EducationController::class, 'store']);
$router->register('PUT', 'education', [EducationController::class, 'update']);
$router->register('DELETE', 'education', [EducationController::class, 'destroy']);

$router->register('GET', 'experiences', [ExperienceController::class, 'index']);
$router->register('POST', 'experiences', [ExperienceController::class, 'store']);
$router->register('PUT', 'experiences', [ExperienceController::class, 'update']);
$router->register('DELETE', 'experiences', [ExperienceController::class, 'destroy']);

$router->register('GET', 'projects', [ProjectController::class, 'index']);
$router->register('POST', 'projects', [ProjectController::class, 'store']);
$router->register('PUT', 'projects', [ProjectController::class, 'update']);
$router->register('DELETE', 'projects', [ProjectController::class, 'destroy']);

$router->register('GET', 'testimonials', [TestimonialController::class, 'index']);
$router->register('POST', 'testimonials', [TestimonialController::class, 'store']);
$router->register('PUT', 'testimonials', [TestimonialController::class, 'update']);
$router->register('DELETE', 'testimonials', [TestimonialController::class, 'destroy']);

$router->register('POST', 'selection', [SelectionController::class, 'generate']);

$router->dispatch($method, $route);
