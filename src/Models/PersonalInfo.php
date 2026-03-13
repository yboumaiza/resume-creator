<?php

class PersonalInfo
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    public function get(): ?array
    {
        $stmt = $this->db->query('SELECT * FROM personal_info WHERE id = 1');
        $row = $stmt->fetch();
        if (!$row) return null;
        $row['languages'] = json_decode($row['languages'], true) ?? [];
        return $row;
    }

    public function save(array $data): bool
    {
        $stmt = $this->db->prepare(
            'INSERT INTO personal_info (id, full_name, header_text, phone, location, email, linkedin, portfolio, languages)
             VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
             full_name = VALUES(full_name),
             header_text = VALUES(header_text),
             phone = VALUES(phone),
             location = VALUES(location),
             email = VALUES(email),
             linkedin = VALUES(linkedin),
             portfolio = VALUES(portfolio),
             languages = VALUES(languages)'
        );

        return $stmt->execute([
            $data['full_name'] ?? '',
            $data['header_text'] ?? '',
            $data['phone'] ?? '',
            $data['location'] ?? '',
            $data['email'] ?? '',
            $data['linkedin'] ?? '',
            $data['portfolio'] ?? '',
            json_encode($data['languages'] ?? []),
        ]);
    }
}
