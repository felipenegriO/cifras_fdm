<?php
require_once __DIR__ . '/src/backend/bootstrap.php';
$controller = new IndexController();
$controller->show();