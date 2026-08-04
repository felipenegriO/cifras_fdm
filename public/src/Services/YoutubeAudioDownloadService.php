<?php
/**
 * YoutubeAudioDownloadService — resolves a YouTube video id to a locally
 * cached MP3 file, trying a chain of free conversion APIs.
 *
 * All network/filesystem access is injected as closures so the branching
 * logic (cache hit, provider fallback chain, failure paths) can be unit
 * tested without making real HTTP requests.
 */
class YoutubeAudioDownloadService
{
    /** @var callable(string $url, int $timeout): (string|false) */
    private $httpGet;
    /** @var callable(string $path): bool */
    private $fileExists;
    /** @var callable(string $path): int */
    private $fileSize;
    /** @var callable(string $dir): bool */
    private $isDir;
    /** @var callable(string $dir, int $mode): bool */
    private $mkdir;
    /** @var callable(string $path, string $content): (int|false) */
    private $filePutContents;

    public function __construct(array $deps = [])
    {
        $this->httpGet = $deps['httpGet'] ?? function (string $url, int $timeout) {
            $context = stream_context_create([
                'http' => [
                    'user_agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'timeout' => $timeout,
                    'ignore_errors' => true,
                ],
            ]);
            return @file_get_contents($url, false, $context);
        };
        $this->fileExists = $deps['fileExists'] ?? 'file_exists';
        $this->fileSize = $deps['fileSize'] ?? 'filesize';
        $this->isDir = $deps['isDir'] ?? 'is_dir';
        $this->mkdir = $deps['mkdir'] ?? function (string $dir, int $mode) {
            return mkdir($dir, $mode, true);
        };
        $this->filePutContents = $deps['filePutContents'] ?? 'file_put_contents';
    }

    public function isValidVideoId(?string $videoId): bool
    {
        return is_string($videoId) && preg_match('/^[a-zA-Z0-9_-]{11}$/', $videoId) === 1;
    }

    public function ensureUploadDir(string $uploadDir): bool
    {
        if (($this->isDir)($uploadDir)) {
            return true;
        }
        return ($this->mkdir)($uploadDir, 0755);
    }

    public function buildFileName(string $videoId, ?string $rawTitle): string
    {
        $title = $rawTitle !== null && $rawTitle !== '' ? $rawTitle : ('audio_' . $videoId);
        $title = preg_replace('/[^a-zA-Z0-9_-]/', '_', substr($title, 0, 50));
        return "yt_{$videoId}_{$title}.mp3";
    }

    public function fetchTitle(string $videoId): ?string
    {
        $oembedUrl = "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=" . urlencode($videoId) . "&format=json";
        $raw = ($this->httpGet)($oembedUrl, 10);
        $meta = $raw ? @json_decode($raw, true) : null;
        return ($meta && isset($meta['title'])) ? $meta['title'] : null;
    }

    public function isCached(string $filePath): bool
    {
        return ($this->fileExists)($filePath) && ($this->fileSize)($filePath) > 100000;
    }

    /**
     * Attempts to resolve+download the MP3 via the provider chain.
     * Returns true on success, false if every provider failed.
     */
    public function downloadViaProviders(string $videoId, string $fileName, string $uploadDir): bool
    {
        foreach ($this->providers() as $providerUrl) {
            $result = $this->callJsonApi($providerUrl($videoId));
            if ($result && isset($result['url'])) {
                $dlPath = $this->saveRemoteFile($result['url'], $fileName, $uploadDir);
                if ($dlPath !== null && ($this->fileSize)($dlPath) > 100000) {
                    return true;
                }
            }
        }
        return false;
    }

    private function providers(): array
    {
        return [
            fn($id) => "https://ezdownloader.com/api/download?url=https://www.youtube.com/watch?v=" . urlencode($id) . "&format=mp3",
            fn($id) => "https://www.getfbstuff.com/api/v2/downloader/?url=https://www.youtube.com/watch?v=" . urlencode($id),
        ];
    }

    private function callJsonApi(string $url): ?array
    {
        $response = ($this->httpGet)($url, 10);
        if (!$response) {
            return null;
        }
        $decoded = json_decode($response, true);
        return is_array($decoded) ? $decoded : null;
    }

    public function saveRemoteFile(?string $fileUrl, string $fileName, string $uploadDir): ?string
    {
        if (!$fileUrl || !filter_var($fileUrl, FILTER_VALIDATE_URL)) {
            return null;
        }

        $fileContent = ($this->httpGet)($fileUrl, 30);
        if (!$fileContent || strlen($fileContent) < 1000 || strlen($fileContent) > 50 * 1024 * 1024 || !$this->isAudioPayload($fileContent)) {
            return null;
        }

        $filePath = $uploadDir . $fileName;
        if (($this->filePutContents)($filePath, $fileContent) === false) {
            return null;
        }

        return $filePath;
    }

    private function isAudioPayload(string $content): bool
    {
        $prefix = substr($content, 0, 16);
        if (str_starts_with($prefix, 'ID3') || str_starts_with($prefix, 'OggS') || str_starts_with($prefix, 'RIFF')) {
            return true;
        }
        if (strlen($prefix) >= 2 && ord($prefix[0]) === 0xFF && (ord($prefix[1]) & 0xE0) === 0xE0) {
            return true;
        }
        return strlen($prefix) >= 8 && substr($prefix, 4, 4) === 'ftyp';
    }
}
