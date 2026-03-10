<?php

class Project
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    public function getAll(): array
    {
        $stmt = $this->db->query('SELECT * FROM projects ORDER BY created_at DESC');
        $rows = $stmt->fetchAll();
        return array_map([$this, 'decode'], $rows);
    }

    public function getById(int $id): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM projects WHERE id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        return $row ? $this->decode($row) : null;
    }

    public function getByIds(array $ids): array
    {
        if (empty($ids)) return [];
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $stmt = $this->db->prepare("SELECT * FROM projects WHERE id IN ($placeholders) ORDER BY created_at DESC");
        $stmt->execute(array_values($ids));
        return array_map([$this, 'decode'], $stmt->fetchAll());
    }

    public function create(array $data): int
    {
        $stmt = $this->db->prepare(
            'INSERT INTO projects (name, description, url, skills) VALUES (?, ?, ?, ?)'
        );
        $stmt->execute([
            $data['name'],
            $data['description'],
            $data['url'] ?? null,
            json_encode($data['skills'] ?? []),
        ]);
        return (int) $this->db->lastInsertId();
    }

    public function update(int $id, array $data): bool
    {
        $fields = [];
        $values = [];

        foreach (['name', 'description', 'url'] as $field) {
            if (array_key_exists($field, $data)) {
                $fields[] = "$field = ?";
                $values[] = $data[$field];
            }
        }

        if (array_key_exists('skills', $data)) {
            $fields[] = 'skills = ?';
            $values[] = json_encode($data['skills']);
        }

        if (empty($fields)) return false;

        $values[] = $id;
        $stmt = $this->db->prepare('UPDATE projects SET ' . implode(', ', $fields) . ' WHERE id = ?');
        return $stmt->execute($values);
    }

    public function delete(int $id): bool
    {
        $stmt = $this->db->prepare('DELETE FROM projects WHERE id = ?');
        return $stmt->execute([$id]);
    }

    private function decode(array $row): array
    {
        $row['skills'] = json_decode($row['skills'], true) ?? [];
        return $row;
    }
}
