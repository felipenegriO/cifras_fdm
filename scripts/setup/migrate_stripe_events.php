<?php
require_once __DIR__ . '/../../public/src/backend/bootstrap.php';

$pdo = Database::getConnection();
$pdo->exec("CREATE TABLE IF NOT EXISTS stripe_webhook_events (
    event_id VARCHAR(255) PRIMARY KEY,
    event_type VARCHAR(120) NOT NULL,
    resource_id VARCHAR(255) NOT NULL,
    event_created BIGINT UNSIGNED NOT NULL,
    status ENUM('processing','processed','ignored','failed') NOT NULL DEFAULT 'processing',
    processed_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_stripe_events_resource_created (resource_id, event_created)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
$pdo->exec("CREATE TABLE IF NOT EXISTS stripe_webhook_resources (
    resource_id VARCHAR(255) PRIMARY KEY,
    last_event_created BIGINT UNSIGNED NOT NULL,
    last_event_id VARCHAR(255) NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

echo "Migração Stripe concluída.\n";
