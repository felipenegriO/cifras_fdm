<?php
/**
 * Download and Convert YouTube Audio to MP3
 *
 * Endpoint: POST /src/backend/download-yt-audio.php
 * Body: {"videoId": "dQw4w9WgXcQ"}
 *
 * Hostinger-Compatible: Uses public APIs instead of yt-dlp.
 * Business logic lives in YoutubeAudioDownloadService (unit-tested);
 * this file only wires HTTP request/response.
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

$service = new YoutubeAudioDownloadService();

$postData = json_decode(file_get_contents("php://input"), true);
$videoId = isset($postData['videoId']) ? trim($postData['videoId']) : null;

if (!$service->isValidVideoId($videoId)) {
    sendJsonError("Invalid or missing videoId", 400);
}

$uploadDir = __DIR__ . "/../../rehearsal-audio/";
if (!$service->ensureUploadDir($uploadDir)) {
    sendJsonError("Cannot create upload directory", 500);
}

$videoTitle = $service->fetchTitle($videoId);
$fileName = $service->buildFileName($videoId, $videoTitle);
$filePath = $uploadDir . $fileName;

if ($service->isCached($filePath)) {
    sendJsonSuccess([
        "success" => true,
        "audioPath" => "/rehearsal-audio/" . $fileName,
        "fileName" => $fileName,
        "videoId" => $videoId,
        "cached" => true
    ]);
}

$downloaded = $service->downloadViaProviders($videoId, $fileName, $uploadDir);

if (!$downloaded) {
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
