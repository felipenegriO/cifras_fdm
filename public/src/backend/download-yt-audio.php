<?php
/**
 * Download and Convert YouTube Audio to MP3
 * 
 * Endpoint: POST /src/backend/download-yt-audio.php
 * Body: {"videoId": "dQw4w9WgXcQ"}
 * 
 * Hostinger-Compatible: Uses public APIs instead of yt-dlp
 */

require_once __DIR__ . '/bootstrap.php';
header("Content-Type: application/json; charset=utf-8");

require_auth_json();
require_csrf();

function sendJsonError($message, $code = 400) {
    http_response_code($code);
    echo json_encode(["error" => $message]);
    exit;
}

function sendJsonSuccess($data) {
    echo json_encode($data);
    exit;
}

function fetchWithUserAgent($url, $timeout = 10) {
    $context = stream_context_create([
        'http' => [
            'user_agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'timeout' => $timeout,
            'ignore_errors' => true
        ]
    ]);
    return @file_get_contents($url, false, $context);
}

function convertWithYoutubeToMp3($videoId, $title) {
    /**
     * Alternative 1: y2mate.com API (free, no key required)
     * Converts video to MP3 via JavaScript/API
     */
    
    $youtubeUrl = "https://www.youtube.com/watch?v=" . $videoId;
    $api = "https://y2mate.com/api/v2/convert";
    
    $postData = [
        'url' => $youtubeUrl,
        'vQuality' => 'mp3',
        'aFormat' => 'mp3'
    ];
    
    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
            'content' => http_build_query($postData),
            'timeout' => 15,
            'user_agent' => 'Mozilla/5.0'
        ]
    ]);
    
    $response = @file_get_contents($api, false, $context);
    return $response ? json_decode($response, true) : null;
}

function getMp3LinkViaEZVideoDownloader($videoId) {
    /**
     * Alternative 2: EZ Video Downloader API (free)
     * Returns direct MP3 download link
     */
    $url = "https://ezdownloader.com/api/download?url=https://www.youtube.com/watch?v=" . urlencode($videoId) . "&format=mp3";
    $response = fetchWithUserAgent($url, 10);
    return $response ? json_decode($response, true) : null;
}

function getMp3LinkViaFastDownloader($videoId) {
    /**
     * Alternative 3: Fast Downloader API
     * Returns JSON with download links
     */
    $url = "https://www.getfbstuff.com/api/v2/downloader/?url=https://www.youtube.com/watch?v=" . urlencode($videoId);
    $response = fetchWithUserAgent($url, 10);
    return $response ? json_decode($response, true) : null;
}

function saveRemoteFile($fileUrl, $fileName, $uploadDir) {
    /**
     * Downloads a remote file and saves locally
     */
    if (!$fileUrl || !filter_var($fileUrl, FILTER_VALIDATE_URL)) {
        return null;
    }
    
    $context = stream_context_create([
        'http' => [
            'timeout' => 30,
            'user_agent' => 'Mozilla/5.0'
        ]
    ]);
    
    $fileContent = @file_get_contents($fileUrl, false, $context);
    if (!$fileContent || strlen($fileContent) < 1000) {
        return null;
    }
    
    $filePath = $uploadDir . $fileName;
    if (file_put_contents($filePath, $fileContent) === false) {
        return null;
    }
    
    return $filePath;
}

$postData = json_decode(file_get_contents("php://input"), true);
$videoId = isset($postData['videoId']) ? trim($postData['videoId']) : null;

if (!$videoId || !preg_match('/^[a-zA-Z0-9_-]{11}$/', $videoId)) {
    sendJsonError("Invalid or missing videoId", 400);
}

$uploadDir = __DIR__ . "/../../rehearsal-audio/";
if (!is_dir($uploadDir)) {
    if (!mkdir($uploadDir, 0755, true)) {
        sendJsonError("Cannot create upload directory", 500);
    }
}

// Try to download via YouTube oEmbed metadata first (for filename)
$oembedUrl = "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=" . urlencode($videoId) . "&format=json";
$videoMeta = @json_decode(fetchWithUserAgent($oembedUrl), true);
$videoTitle = ($videoMeta && isset($videoMeta['title'])) ? $videoMeta['title'] : "audio_" . $videoId;
$videoTitle = preg_replace('/[^a-zA-Z0-9_-]/', '_', substr($videoTitle, 0, 50));

$fileName = "yt_" . $videoId . "_" . $videoTitle . ".mp3";
$filePath = $uploadDir . $fileName;

// Check if already downloaded
if (file_exists($filePath) && filesize($filePath) > 100000) {
    sendJsonSuccess([
        "success" => true,
        "audioPath" => "/rehearsal-audio/" . $fileName,
        "fileName" => $fileName,
        "videoId" => $videoId,
        "cached" => true
    ]);
}

/**
 * Try multiple free APIs in order
 */
$downloaded = false;

// Try 1: EZ Video Downloader
$result = getMp3LinkViaEZVideoDownloader($videoId);
if ($result && isset($result['url'])) {
    $dlPath = saveRemoteFile($result['url'], $fileName, $uploadDir);
    if ($dlPath && filesize($dlPath) > 100000) {
        $downloaded = true;
    }
}

// Try 2: Fast Downloader (fallback)
if (!$downloaded) {
    $result = getMp3LinkViaFastDownloader($videoId);
    if ($result && isset($result['url'])) {
        $dlPath = saveRemoteFile($result['url'], $fileName, $uploadDir);
        if ($dlPath && filesize($dlPath) > 100000) {
            $downloaded = true;
        }
    }
}

// Try 3: YouTube direct audio extraction (fallback)
if (!$downloaded) {
    $youtubeUrl = "https://www.youtube.com/watch?v=" . $videoId;
    // Nota: Esta é uma solicitação HTTP simples; geralmente falha em servidores compartilhados
    // Deixamos usar a alternativa do yt-dlp localmente se disponível
}

if (!$downloaded) {
    // Fallback: instruir usuário a carregar manualmente
    sendJsonError(
        "Conversão automática momentaneamente indisponível. " .
        "Use um conversor online (ex: https://y2mate.com/) e faça upload do MP3 resultante.",
        503
    );
}

sendJsonSuccess([
    "success" => true,
    "audioPath" => "/rehearsal-audio/" . $fileName,
    "fileName" => $fileName,
    "videoId" => $videoId,
    "cached" => false
]);
?>

