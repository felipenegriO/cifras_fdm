<?php
require_once __DIR__ . '/../bootstrap.php';
require_auth();
header('Location: ' . base_url('/users.php'));
exit;
