<?php
require_once __DIR__ . '/../../public/config/env.php';

$host = (string) env('DB_HOST', '127.0.0.1');
$port = (string) env('DB_PORT', '3306');
$user = (string) env('DB_USER', 'root');
$pass = (string) env('DB_PASS', '');
$database = 'cifro_demo';

if (!in_array($host, ['localhost', '127.0.0.1', '::1'], true)) {
    throw new RuntimeException("Seed de demonstracao permitido apenas em MySQL local. DB_HOST={$host}");
}
if ($database === trim((string) env('DB_NAME', ''))) {
    throw new RuntimeException('O banco de demonstracao nao pode ser o banco configurado em DB_NAME.');
}

$server = new PDO("mysql:host={$host};port={$port};charset=utf8mb4", $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$server->exec("DROP DATABASE IF EXISTS `{$database}`");
$server->exec("CREATE DATABASE `{$database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");

$pdo = new PDO("mysql:host={$host};port={$port};dbname={$database};charset=utf8mb4", $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$schema = file_get_contents(__DIR__ . '/../../create_tables.sql');
foreach (preg_split('/;\s*(?:\r?\n|$)/', preg_replace('/^\s*--.*$/m', '', $schema)) as $statement) {
    if (trim($statement) === '') continue;
    try { $pdo->exec($statement); }
    catch (PDOException $error) {
        if (!in_array((int)($error->errorInfo[1] ?? 0), [1060, 1061], true)) throw $error;
    }
}

$bandId   = '00000000-0000-4000-8000-0000000000d1';
$hostId   = '00000000-0000-4000-8000-0000000000d2';
$memberId = '00000000-0000-4000-8000-0000000000d3';
$password = password_hash('CifroDemo#2026!', PASSWORD_DEFAULT);

// Repertorio 100% autoral: letra e acordes escritos para esta demonstracao.
// Nenhuma letra de musica de terceiro aparece em lugar nenhum do video.
//
// As cifras precisam ser MAIS LONGAS QUE UMA TELA de 376x826, senao a cena de
// rolagem automatica do Reel (quadros 510-600) nao tem o que rolar e sobra
// espaco morto na tela do celular. Por isso a estrutura completa abaixo:
// Intro, Verso 1, Refrao, Verso 2, Refrao, Ponte, Refrao final.
$cifra = static function (array $acordes, array $letra): string {
    [$intro, $verso, $refrao, $ponte] = $acordes;
    [$verso1, $verso2, $coro, $bridge] = $letra;

    $linhas = static fn (array $ls): string => implode('', array_map(
        static fn (string $l): string => '<p>' . $l . '</p>',
        $ls
    ));
    $secao = static fn (string $nome, string $ac): string =>
        "<p><b>[{$nome}]</b></p><p><b>{$ac}</b></p>";

    return $secao('Intro', $intro)
        . $secao('Verso 1', $verso) . $linhas($verso1)
        . $secao('Refrão', $refrao) . $linhas($coro)
        . $secao('Verso 2', $verso) . $linhas($verso2)
        . $secao('Refrão', $refrao) . $linhas($coro)
        . $secao('Ponte', $ponte) . $linhas($bridge)
        . $secao('Verso 3', $verso) . $linhas($verso1)
        . $secao('Refrão', $refrao) . $linhas($coro)
        . $secao('Ponte', $ponte) . $linhas($bridge)
        . $secao('Refrão final', $refrao) . $linhas($coro);
};

$songs = [
    ['Amanhecer', 'Minha Banda', $cifra(
        ['G  D  Em  C', 'G  D  Em  C', 'C  G  D  Em', 'Em  C  G  D'],
        [
            ['A manhã nova sobre a estrada,', 'o passo firme outra vez.', 'quem esperou já pode cantar.'],
            ['O que era peso virou canto,', 'o que era pressa virou paz.', 'e o dia abre devagar.'],
            ['Canta comigo esse começo,', 'que a noite já passou.'],
            ['Não é o relógio que decide', 'a hora de recomeçar.'],
        ]
    ), '92'],
    ['Estrada Velha', 'Minha Banda', $cifra(
        ['D  A  Bm  G', 'D  A  Bm  G', 'G  D  A  Bm', 'Bm  G  D  A'],
        [
            ['A estrada velha ainda lembra', 'de cada volta que eu já dei.', 'o asfalto guarda o que eu deixei.'],
            ['Levo pouco na bagagem,', 'o resto o vento carregou.', 'fica o mapa que eu rasguei.'],
            ['Segue comigo essa viagem,', 'que o caminho é quem me leva.'],
            ['Toda partida é uma promessa', 'de que um dia eu volto aqui.'],
        ]
    ), '108'],
    ['Casa Cheia', 'Minha Banda', $cifra(
        ['E  B  C#m  A', 'E  B  C#m  A', 'A  E  B  C#m', 'C#m  A  E  B'],
        [
            ['A mesa posta, a porta aberta,', 'ninguém janta sozinho aqui.', 'chega quem vem, fica quem quer.'],
            ['O barulho é bem-vindo,', 'a bagunça faz sentido.', 'cadeira sempre sobra pra mais um.'],
            ['Casa cheia é casa viva,', 'e a nossa nunca esvaziou.'],
            ['Quem chegou por acaso', 'já não sabe mais sair.'],
        ]
    ), '126'],
    ['Passo Firme', 'Minha Banda', $cifra(
        ['C  G  Am  F', 'C  G  Am  F', 'F  C  G  Am', 'Am  F  C  G'],
        [
            ['Não é força, é insistência,', 'é levantar de novo e ir.', 'o chão não muda, quem muda sou eu.'],
            ['Devagar também é avanço,', 'quem para é que fica pra trás.', 'conto os passos, não os anos.'],
            ['Passo firme, mesmo lento,', 'chega longe do lugar.'],
            ['A pressa cansa antes da chegada,', 'a calma dura a viagem toda.'],
        ]
    ), '84'],
    ['Luz da Manhã', 'Minha Banda', $cifra(
        ['A  E  F#m  D', 'A  E  F#m  D', 'D  A  E  F#m', 'F#m  D  A  E'],
        [
            ['A luz da manhã não pergunta', 'se a noite foi longa demais.', 'ela chega do mesmo jeito.'],
            ['Abre a janela devagar,', 'deixa o escuro ir embora.', 'nada aqui ficou perdido.'],
            ['Toda manhã é uma resposta', 'pra pergunta de ontem à noite.'],
            ['Se demorou, não foi ausência,', 'foi só o tempo do amanhecer.'],
        ]
    ), '96'],
    ['Voltar pra Casa', 'Minha Banda', $cifra(
        ['F  C  Dm  Bb', 'F  C  Dm  Bb', 'Bb  F  C  Dm', 'Dm  Bb  F  C'],
        [
            ['Andei bastante pra saber', 'que o longe não me cabia.', 'toda distância me trouxe aqui.'],
            ['Não é derrota quem retorna,', 'é quem descobriu o caminho.', 'deixo a estrada e fico aqui.'],
            ['Voltar pra casa não é parar,', 'é finalmente chegar.'],
            ['O que eu procurava lá fora', 'estava esperando na porta.'],
        ]
    ), '72'],
];

$pdo->beginTransaction();
try {
    $pdo->prepare("INSERT INTO bandas (id,nome,ativo,plano) VALUES (?, 'Minha Banda', 1, 'gratuito')")->execute([$bandId]);

    $insertUser = $pdo->prepare("INSERT INTO usuarios (id,nome,email,senha_hash,perfil,ativo,plano) VALUES (?,?,?,?,?,1,'ativo')");
    $insertUser->execute([$hostId,   'Felipe',  'host@demo.local',   $password, 'master']);
    $insertUser->execute([$memberId, 'Juliana', 'membro@demo.local', $password, 'usuario']);

    $link = $pdo->prepare("INSERT INTO usuario_banda (usuario_id,banda_id,perfil) VALUES (?,?,?)");
    $link->execute([$hostId,   $bandId, 'administrador']);
    $link->execute([$memberId, $bandId, 'basico']);

    $insertSong = $pdo->prepare('INSERT INTO musicas (banda_id,nome,artista,cifra,bit) VALUES (?,?,?,?,?)');
    $songIds = [];
    foreach ($songs as [$nome, $artista, $cifraHtml, $bpm]) {
        $insertSong->execute([$bandId, $nome, $artista, $cifraHtml, $bpm]);
        $songIds[] = (int) $pdo->lastInsertId();
    }

    // Playlist = setlist do culto, com o tom de cada musica (formato usado por
    // PlaylistRepository/playlists_salvas.js: [{"id":<int>,"tom":"<acorde>"}]).
    $tons = ['G', 'D', 'E', 'C', 'A', 'F'];
    $itens = [];
    foreach ($songIds as $index => $songId) {
        $itens[] = ['id' => $songId, 'tom' => $tons[$index]];
    }
    // Varios repertorios: com um so, o painel de Repertorios aparece quase vazio
    // no video e contradiz a legenda "Playlist integrada!".
    $insertPlaylist = $pdo->prepare("INSERT INTO playlists (banda_id,nome,visivel_ate,itens) VALUES (?,?,?,?)");
    $subconjunto = static fn (array $indices): string => json_encode(
        array_map(static fn (int $i): array => $itens[$i], $indices),
        JSON_UNESCAPED_UNICODE
    );
    $repertorios = [
        ['Culto de Domingo',      [0, 1, 2, 3, 4, 5]],
        ['Ensaio de quinta',      [2, 4, 0]],
        ['Culto de quarta',       [1, 3, 5]],
        ['Casamento — Marina',    [4, 0, 5]],
        ['Acústico no bar',       [1, 2, 5, 3]],
        ['Repertório de sábado',  [0, 2, 4, 1]],
    ];
    foreach ($repertorios as [$nome, $indices]) {
        $insertPlaylist->execute([$bandId, $nome, null, $subconjunto($indices)]);
    }

    // Roteiro = texto livre (HTML), renderizado direto em roteiro.php. A coluna
    // real e `titulo`, nao `nome` (create_tables.sql:159).
    // Sem travessao (—) no titulo: a fonte do cabecalho de roteiro.php nao tem o
    // glifo e ele renderiza como dois quadrados violeta na tela.
    $roteiroHtml = '<p><b>Abertura</b>: recepção e boas-vindas com "Amanhecer".</p>'
        . '<p>Entrada da equipe, check de som rápido, primeira música em G.</p>'
        . '<p><b>Louvor</b>: sequência "Estrada Velha" e "Casa Cheia".</p>'
        . '<p>Emenda direto, sem parar entre as duas. Segunda em E.</p>'
        . '<p><b>Palavra</b>: pausa musical para a ministração.</p>'
        . '<p>Teclado em base durante o final da mensagem.</p>'
        . '<p><b>Ministração</b>: "Passo Firme" e "Luz da Manhã".</p>'
        . '<p>Clima de entrega, dinâmica baixa no primeiro verso.</p>'
        . '<p><b>Encerramento</b>: "Voltar pra Casa" para fechar.</p>'
        . '<p>Repetir o refrão final enquanto a equipe sai.</p>';
    $pdo->prepare("INSERT INTO roteiros (banda_id,titulo,conteudo) VALUES (?,?,?)")
        ->execute([$bandId, 'Ordem do Culto de Domingo', $roteiroHtml]);

    $pdo->commit();
} catch (Throwable $error) {
    $pdo->rollBack();
    throw $error;
}

echo "Banco de demonstracao pronto: {$database} (" . count($songs) . " musicas, " . count($repertorios) . " repertorios, 1 roteiro)\n";
