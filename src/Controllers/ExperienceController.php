<?php

class ExperienceController
{
    private Experience $model;

    public function __construct()
    {
        $this->model = new Experience();
    }

    public function index(): void
    {
        $id = $_GET['id'] ?? null;

        if ($id !== null) {
            $item = $this->model->getById((int) $id);
            if (!$item) {
                http_response_code(404);
                echo json_encode(['error' => 'Experience not found']);
                return;
            }
            echo json_encode($item);
            return;
        }

        echo json_encode($this->model->getAll());
    }

    public function store(): void
    {
        $data = json_decode(file_get_contents('php://input'), true);

        if (empty($data['company']) || empty($data['title']) || empty($data['start_date']) || empty($data['description'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing required fields: company, title, start_date, description']);
            return;
        }

        $id = $this->model->create($data);
        http_response_code(201);
        echo json_encode(['id' => $id, 'message' => 'Experience created']);
    }

    public function update(): void
    {
        $data = json_decode(file_get_contents('php://input'), true);

        if (empty($data['id'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing id']);
            return;
        }

        $this->model->update((int) $data['id'], $data);
        echo json_encode(['message' => 'Experience updated']);
    }

    public function destroy(): void
    {
        $data = json_decode(file_get_contents('php://input'), true);

        if (empty($data['id'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing id']);
            return;
        }

        $this->model->delete((int) $data['id']);
        echo json_encode(['message' => 'Experience deleted']);
    }
}
