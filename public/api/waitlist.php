<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Metodo nao permitido.']);
    exit;
}

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!is_array($data)) {
    $data = $_POST;
}

// Honeypot: bots costumam preencher todos os campos, inclusive os escondidos.
$honeypot = trim((string)($data['website'] ?? ''));
if ($honeypot !== '') {
    // Finge sucesso pro bot, mas nao grava nada.
    echo json_encode(['success' => true]);
    exit;
}

$email = trim((string)($data['email'] ?? ''));

if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Informe um e-mail valido.']);
    exit;
}

if (mb_strlen($email) > 190) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'E-mail muito longo.']);
    exit;
}

// storage/ fica um nivel acima de api/ (irma da pasta api), tanto na
// estrutura completa do projeto (public/api/..) quanto no pacote avulso
// de deploy (em-breve.html + api/ + storage/ no mesmo nivel).
$storageDir = __DIR__ . '/../storage';
if (!is_dir($storageDir)) {
    $created = @mkdir($storageDir, 0755, true);
    if (!$created && !is_dir($storageDir)) {
        error_log('waitlist.php: falha ao criar storageDir em ' . $storageDir);
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Nao foi possivel salvar agora. Tenta de novo em instantes.']);
        exit;
    }
}
$file = $storageDir . '/waitlist.csv';

// Rate limiting simples por IP, baseado em quantas linhas o IP ja gravou nos ultimos 60s.
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$now = time();

$fp = fopen($file, 'c+');
if ($fp === false) {
    error_log('waitlist.php: falha ao abrir arquivo em ' . $file);
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Nao foi possivel salvar agora. Tenta de novo em instantes.']);
    exit;
}

flock($fp, LOCK_EX);

$existingEmails = [];
$recentFromIp = 0;
rewind($fp);
while (($line = fgets($fp)) !== false) {
    $cols = str_getcsv($line);
    if (count($cols) < 3) {
        continue;
    }
    [$rowEmail, $rowIp, $rowTs] = $cols;
    $existingEmails[strtolower($rowEmail)] = true;
    if ($rowIp === $ip && ($now - (int)$rowTs) < 60) {
        $recentFromIp++;
    }
}

if ($recentFromIp >= 3) {
    flock($fp, LOCK_UN);
    fclose($fp);
    http_response_code(429);
    echo json_encode(['success' => false, 'message' => 'Calma, ja recebemos seu pedido. Tenta novamente em instantes.']);
    exit;
}

if (isset($existingEmails[strtolower($email)])) {
    flock($fp, LOCK_UN);
    fclose($fp);
    echo json_encode(['success' => true, 'message' => 'Voce ja esta na lista! Avisamos assim que lancar.']);
    exit;
}

fseek($fp, 0, SEEK_END);
fputcsv($fp, [$email, $ip, $now, date('c', $now)]);

flock($fp, LOCK_UN);
fclose($fp);

echo json_encode(['success' => true, 'message' => 'Prontinho! Voce esta na lista de espera.']);
