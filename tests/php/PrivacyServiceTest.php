<?php
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../public/src/Services/PrivacyService.php';

final class PrivacyServiceTest extends TestCase
{
    private PDO $pdo;

    protected function setUp(): void
    {
        if (!in_array('sqlite', PDO::getAvailableDrivers(), true)) self::markTestSkipped('PDO SQLite indisponível.');
        $this->pdo = new PDO('sqlite::memory:');
        $this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $this->pdo->exec('PRAGMA foreign_keys=ON');
        $this->pdo->exec('CREATE TABLE usuarios (id TEXT PRIMARY KEY, nome TEXT, email TEXT, perfil TEXT, ativo INTEGER, validade TEXT, config TEXT, criado_em TEXT, senha_hash TEXT)');
        $this->pdo->exec('CREATE TABLE bandas (id TEXT PRIMARY KEY, nome TEXT)');
        $this->pdo->exec('CREATE TABLE usuario_banda (usuario_id TEXT, banda_id TEXT, perfil TEXT, FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE, FOREIGN KEY(banda_id) REFERENCES bandas(id) ON DELETE CASCADE)');
        $this->pdo->exec('CREATE TABLE user_legal_acceptances (usuario_id TEXT, terms_version TEXT, privacy_version TEXT, accepted_at TEXT, FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE)');
        $this->pdo->exec("INSERT INTO usuarios VALUES ('u1','Ana','ana@example.com','usuario',1,NULL,'{\"tema\":\"dark\"}','2026-01-01','segredo')");
        $this->pdo->exec("INSERT INTO bandas VALUES ('b1','Banda 1')");
        $this->pdo->exec("INSERT INTO usuario_banda VALUES ('u1','b1','administrador')");
        $this->pdo->exec("INSERT INTO user_legal_acceptances VALUES ('u1','v1','v2','2026-01-02')");
    }

    public function testExportaSomenteDadosSegurosDaConta(): void
    {
        $data = (new PrivacyService($this->pdo))->exportAccount('u1');
        self::assertSame('ana@example.com', $data['account']['email']);
        self::assertArrayNotHasKey('senha_hash', $data['account']);
        self::assertSame('dark', $data['account']['config']['tema']);
        self::assertSame('b1', $data['band_memberships'][0]['id']);
        self::assertSame('v2', $data['legal_acceptances'][0]['privacy_version']);
    }

    public function testExclusaoRemoveContaEBandaOrfa(): void
    {
        (new PrivacyService($this->pdo))->deleteAccount('u1');
        self::assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM usuarios')->fetchColumn());
        self::assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM bandas')->fetchColumn());
        self::assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM user_legal_acceptances')->fetchColumn());
    }
}
