<?php

class ProjectController
{
    private Project $model;

    public function __construct()
    {
        $this->model = new Project();
    }

    public function index(): void
    {
        $id = $_GET['id'] ?? null;

        if ($id !== null) {
            $item = $this->model->getById((int) $id);
            if (!$item) {
                http_response_code(404);
                echo json_encode(['error' => 'Project not found']);
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

        if (empty($data['name']) || empty($data['description'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing required fields: name, description']);
            return;
        }

        $id = $this->model->create($data);
        http_response_code(201);
        echo json_encode(['id' => $id, 'message' => 'Project created']);
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
        echo json_encode(['message' => 'Project updated']);
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
        echo json_encode(['message' => 'Project deleted']);
    }
}
