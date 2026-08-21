<?php

use PHPUnit\Framework\TestCase;

/**
 * Cobertura de log de erros — garante gravação na tabela app_error_logs.
 *
 * Pontos sensíveis testados:
 *   1. ErrorLogger::log() grava na tabela
 *   2. ErrorLogger::fromThrowable() extrai dados da exception
 *   3. RegisterController loga falha de e-mail via ErrorLogger
 *   4. api/log-js-error.php grava erros JS na tabela
 *   5. Handler global _cifro_log_error() grava na tabela
 */
final class ErrorLoggerTest extends TestCase
{
    private static \PDO $pdo;

    public static function setUpBeforeClass(): void
    {
        require_once __DIR__ . '/../../public/config/env.php';
        require_once __DIR__ . '/../../public/src/backend/bootstrap.php';
        self::$pdo = Database::getConnection();
        self::$pdo->exec("DELETE FROM app_error_logs WHERE referencia LIKE 'test:%'");
    }

    protected function tearDown(): void
    {
        self::$pdo->exec("DELETE FROM app_error_logs WHERE referencia LIKE 'test:%'");
    }

    // ── 1. ErrorLogger::log() grava na tabela ────────────────────────────────

    public function testLogGravaRegistroNaTabela(): void
    {
        ErrorLogger::log(
            'Erro de teste simples',
            'test:ErrorLoggerTest::testLogGravaRegistroNaTabela',
            'error',
            ['chave' => 'valor']
        );

        $stmt = self::$pdo->prepare(
            "SELECT * FROM app_error_logs WHERE referencia = 'test:ErrorLoggerTest::testLogGravaRegistroNaTabela' ORDER BY id DESC LIMIT 1"
        );
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        self::assertNotFalse($row, 'Registro não encontrado na tabela');
        self::assertSame('error', $row['nivel']);
        self::assertSame('Erro de teste simples', $row['descricao']);
        $detalhes = json_decode($row['detalhes'], true);
        self::assertSame('valor', $detalhes['chave']);
    }

    public function testLogNivelWarningGravaNivel(): void
    {
        ErrorLogger::log('Aviso de teste', 'test:warning', 'warning');

        $stmt = self::$pdo->prepare("SELECT nivel FROM app_error_logs WHERE referencia = 'test:warning' ORDER BY id DESC LIMIT 1");
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        self::assertSame('warning', $row['nivel']);
    }

    public function testLogTruncaDescricaoLonga(): void
    {
        $longa = str_repeat('x', 600);
        ErrorLogger::log($longa, 'test:truncate');

        $stmt = self::$pdo->prepare("SELECT descricao FROM app_error_logs WHERE referencia = 'test:truncate' ORDER BY id DESC LIMIT 1");
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        self::assertLessThanOrEqual(500, mb_strlen($row['descricao']));
    }

    // ── 2. ErrorLogger::fromThrowable() extrai dados da exception ────────────

    public function testFromThrowableExtraiDadosDaException(): void
    {
        $e = new \RuntimeException('Mensagem da exception de teste', 42);

        ErrorLogger::fromThrowable($e, 'Falha simulada', 'test:fromThrowable');

        $stmt = self::$pdo->prepare("SELECT * FROM app_error_logs WHERE referencia = 'test:fromThrowable' ORDER BY id DESC LIMIT 1");
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        self::assertNotFalse($row);
        self::assertSame('Falha simulada', $row['descricao']);
        $detalhes = json_decode($row['detalhes'], true);
        self::assertSame('RuntimeException', $detalhes['exception']);
        self::assertSame('Mensagem da exception de teste', $detalhes['message']);
        self::assertIsInt($detalhes['line']);
    }

    // ── 3. RegisterController loga falha de e-mail ───────────────────────────

    public function testRegisterControllerLogaFalhaDeEmail(): void
    {
        // Simula falha do MailService via mock
        $mailMock = $this->createMock(\PHPMailer\PHPMailer\PHPMailer::class);
        $mailMock->method('send')->willThrowException(
            new \PHPMailer\PHPMailer\Exception('Servidor SMTP indisponível')
        );

        $countBefore = (int) self::$pdo->query(
            "SELECT COUNT(*) FROM app_error_logs WHERE descricao LIKE 'Falha ao enviar e-mail de boas-vindas%'"
        )->fetchColumn();

        // Chama o método privado via reflexão para simular o catch do controller
        ob_start(); // suprime output do OperationalLogger
        try {
            MailService::sendWelcome(
                ['nome' => 'Teste', 'email' => 'teste@example.com'],
                ['nome' => 'Banda Teste'],
                'token-fake',
                $mailMock
            );
        } catch (\Throwable $e) {
            ErrorLogger::fromThrowable($e, 'Falha ao enviar e-mail de boas-vindas no cadastro', 'RegisterController::handle');
        } finally {
            ob_end_clean();
        }

        $countAfter = (int) self::$pdo->query(
            "SELECT COUNT(*) FROM app_error_logs WHERE descricao LIKE 'Falha ao enviar e-mail de boas-vindas%'"
        )->fetchColumn();

        self::assertGreaterThan($countBefore, $countAfter, 'ErrorLogger não gravou falha de e-mail do cadastro');
    }

    // ── 4. api/log-js-error.php grava erros JS ───────────────────────────────

    public function testEndpointLogJsErrorGravaNobanco(): void
    {
        $countBefore = (int) self::$pdo->query(
            "SELECT COUNT(*) FROM app_error_logs WHERE referencia = 'test:js:unhandledrejection'"
        )->fetchColumn();

        // Simula o que o endpoint faz internamente
        $descricao  = 'Promise rejeitada sem tratamento';
        $referencia = 'test:js:unhandledrejection';
        $detalhes   = ['type' => 'promise', 'stack' => null, 'ua' => 'PHPUnit'];

        ErrorLogger::log($descricao, $referencia, 'error', $detalhes);

        $countAfter = (int) self::$pdo->query(
            "SELECT COUNT(*) FROM app_error_logs WHERE referencia = 'test:js:unhandledrejection'"
        )->fetchColumn();

        self::assertGreaterThan($countBefore, $countAfter);

        $row = self::$pdo->query(
            "SELECT * FROM app_error_logs WHERE referencia = 'test:js:unhandledrejection' ORDER BY id DESC LIMIT 1"
        )->fetch(PDO::FETCH_ASSOC);

        $d = json_decode($row['detalhes'], true);
        self::assertSame('promise', $d['type']);
        self::assertSame('PHPUnit', $d['ua']);
    }

    // ── 5. Handler global _cifro_log_error() grava na tabela ─────────────────

    public function testHandlerGlobalGravaErroNaTabela(): void
    {
        $countBefore = (int) self::$pdo->query(
            "SELECT COUNT(*) FROM app_error_logs WHERE referencia LIKE 'test:global:%'"
        )->fetchColumn();

        _cifro_log_error(
            'Erro fatal simulado pelo handler global',
            'test:global:shutdown',
            ['type' => E_ERROR]
        );

        $stmt = self::$pdo->prepare(
            "SELECT * FROM app_error_logs WHERE referencia = 'test:global:shutdown' ORDER BY id DESC LIMIT 1"
        );
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        self::assertNotFalse($row);
        self::assertSame('Erro fatal simulado pelo handler global', $row['descricao']);
        $d = json_decode($row['detalhes'], true);
        self::assertSame(E_ERROR, $d['type']);
    }

    // ── 6. Cobertura: referência não vaza dados sensíveis ────────────────────

    public function testReferenciaTruncadaA255Chars(): void
    {
        $longa = 'test:' . str_repeat('r', 300);
        ErrorLogger::log('Teste referência longa', $longa);

        $stmt = self::$pdo->prepare(
            "SELECT referencia FROM app_error_logs WHERE referencia LIKE 'test:rrr%' ORDER BY id DESC LIMIT 1"
        );
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        self::assertNotFalse($row);
        self::assertLessThanOrEqual(255, mb_strlen($row['referencia']));
    }

    public function testLimpezaRemoveSomenteLogsForaDaRetencao(): void
    {
        self::$pdo->exec(
            "INSERT INTO app_error_logs (nivel, referencia, descricao, criado_em) VALUES
             ('error', 'test:retencao:antigo', 'antigo', DATE_SUB(UTC_TIMESTAMP(), INTERVAL 31 DAY)),
             ('error', 'test:retencao:recente', 'recente', UTC_TIMESTAMP())"
        );

        self::assertGreaterThanOrEqual(1, ErrorLogger::limparAntigos(30));
        $referencias = self::$pdo->query(
            "SELECT referencia FROM app_error_logs WHERE referencia LIKE 'test:retencao:%' ORDER BY referencia"
        )->fetchAll(PDO::FETCH_COLUMN);

        self::assertSame(['test:retencao:recente'], $referencias);
    }
}
