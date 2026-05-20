<?php
/**
 * GET /api/csrf.php — returns a CSRF token for the current session.
 * Lightweight endpoint used by tests to obtain a valid CSRF token
 * without triggering the full index.php page load (and background JS).
 */
require_once __DIR__ . '/../src/backend/bootstrap.php';
header('Content-Type: application/json; charset=utf-8');
send_no_cache_headers();
require_auth_json();

$token = csrf_token();
session_write_close();

echo json_encode(['csrf_token' => $token]);
