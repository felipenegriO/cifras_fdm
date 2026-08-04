<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
http_response_code(200);
echo json_encode(['status' => 'ok', 'service' => 'cifro', 'request_id' => bin2hex(random_bytes(8))]);
