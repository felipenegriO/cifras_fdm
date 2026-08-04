<?php
require_once __DIR__ . '/src/backend/bootstrap.php';
$controller = new ConfigController();
$controller->show();
