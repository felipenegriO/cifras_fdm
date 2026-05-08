<?php
class UserRepository {
    private $filePath;

    public function __construct($filePath) {
        $this->filePath = $filePath;
    }

    public function getAll() {
        if (!file_exists($this->filePath)) {
            return [];
        }

        $json = file_get_contents($this->filePath);
        $data = json_decode($json, true);
        return is_array($data) ? $data : [];
    }

    public function findByUsername($username) {
        $login = strtolower(trim((string) $username));
        $users = $this->getAll();

        foreach ($users as $user) {
            $current = strtolower(trim($user['username'] ?? ''));
            if ($current === $login) {
                return $user;
            }
        }

        return null;
    }
}
