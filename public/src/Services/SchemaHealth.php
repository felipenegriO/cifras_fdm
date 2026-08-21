<?php

/**
 * SchemaHealth — o banco está no estado que este código espera?
 *
 * Existe por causa de um incidente concreto: o banco de produção nunca havia
 * recebido uma migration, `usuario_musica` não existia, e todo request
 * autenticado de sync respondia 500 — enquanto a suíte local passava inteira e
 * health.php respondia 'ok'. A suíte não tinha como ver: o banco de teste é
 * derrubado e recriado do baseline a cada execução, então nasce sempre
 * completo. Só uma checagem contra o banco real fecha essa distância.
 */
final class SchemaHealth
{
    /**
     * @return array{status:string, http_status:int, pending_migrations:list<string>}
     */
    public static function report(MigrationRunner $runner): array
    {
        try {
            $pendentes = $runner->pendingIds();
        } catch (Throwable) {
            // Sem detalhe do erro na resposta: health é endpoint público, e o
            // que interessa a quem monitora é o veredito, não a stack.
            return ['status' => 'unavailable', 'http_status' => 503, 'pending_migrations' => []];
        }

        return $pendentes === []
            ? ['status' => 'ok', 'http_status' => 200, 'pending_migrations' => []]
            : ['status' => 'degraded', 'http_status' => 503, 'pending_migrations' => $pendentes];
    }
}
