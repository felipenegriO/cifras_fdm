<?php
/**
 * Endereço mantido só por compatibilidade: o conteúdo virou a aba "membros" do
 * Minha Banda. Favoritos, e-mails já enviados e links antigos continuam
 * funcionando. A query original é repassada por precaução.
 */
require_once __DIR__ . '/src/backend/bootstrap.php';

$query = $_GET;
unset($query['aba']);
$extra = $query ? '&' . http_build_query($query) : '';

header('Location: ' . base_url('/minha-banda.php?aba=membros' . $extra), true, 302);
exit;
