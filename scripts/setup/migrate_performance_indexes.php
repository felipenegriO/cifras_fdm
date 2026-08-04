<?php
require_once __DIR__ . '/../../public/config/env.php';
require_once __DIR__ . '/../../public/src/Services/Database.php';

$pdo = Database::getConnection();
$column = $pdo->prepare('SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?');
$column->execute(['musicas', 'source_url']);
if ((int) $column->fetchColumn() === 0) $pdo->exec('ALTER TABLE musicas ADD COLUMN source_url VARCHAR(2048) DEFAULT NULL AFTER bit');
$indexes = [
    ['usuario_banda', 'idx_usuario_banda_banda_perfil', 'banda_id, perfil'],
    ['musicas', 'idx_musicas_banda_atualizado', 'banda_id, atualizado_em'],
    ['musicas', 'idx_musicas_banda_classificacao', 'banda_id, classificacao'],
    ['playlists', 'idx_playlists_banda_visibilidade', 'banda_id, visivel_ate, atualizado_em'],
    ['roteiros', 'idx_roteiros_banda_visibilidade', 'banda_id, visivel_ate, atualizado_em'],
];

$exists = $pdo->prepare(
    'SELECT COUNT(*) FROM information_schema.statistics '
    . 'WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?'
);
foreach ($indexes as [$table, $name, $columns]) {
    $exists->execute([$table, $name]);
    if ((int) $exists->fetchColumn() > 0) continue;
    $pdo->exec("CREATE INDEX `{$name}` ON `{$table}` ({$columns})");
    echo "Índice criado: {$name}\n";
}
