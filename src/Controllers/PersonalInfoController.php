<?php

class PersonalInfoController
{
    private PersonalInfo $model;

    public function __construct()
    {
        $this->model = new PersonalInfo();
    }

    public function index(): void
    {
        $data = $this->model->get();
        echo json_encode($data ?? (object) []);
    }

    public function store(): void
    {
        $data = json_decode(file_get_contents('php://input'), true);

        if (empty($data['full_name'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing required field: full_name']);
            return;
        }

        $this->model->save($data);
        echo json_encode(['message' => 'Personal info saved']);
    }
}
