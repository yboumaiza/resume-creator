<?php

class CertificationController
{
    private Certification $model;

    public function __construct()
    {
        $this->model = new Certification();
    }

    public function index(): void
    {
        $id = $_GET['id'] ?? null;

        if ($id !== null) {
            $item = $this->model->getById((int) $id);
            if (!$item) {
                http_response_code(404);
                echo json_encode(['error' => 'Certification not found']);
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

        if (empty($data['source']) || empty($data['expertise'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing required fields: source, expertise']);
            return;
        }

        $id = $this->model->create($data);
        http_response_code(201);
        echo json_encode(['id' => $id, 'message' => 'Certification created']);
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
        echo json_encode(['message' => 'Certification updated']);
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
        echo json_encode(['message' => 'Certification deleted']);
    }
}
