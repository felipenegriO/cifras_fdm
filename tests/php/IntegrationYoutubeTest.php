<?php

/** @group integration */
final class IntegrationYoutubeTest extends \PHPUnit\Framework\TestCase
{
    public function testConverteVideoRealEProduzAudioReproduzivel(): void
    {
        $videoId = trim((string) env('E2E_YOUTUBE_VIDEO_ID', ''));
        if (!preg_match('/^[A-Za-z0-9_-]{11}$/', $videoId)) {
            self::markTestSkipped('E2E_YOUTUBE_VIDEO_ID não configurado com um vídeo autorizado para teste.');
        }

        $service = new YoutubeAudioDownloadService();
        $directory = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'cifro-youtube-e2e-' . bin2hex(random_bytes(6)) . DIRECTORY_SEPARATOR;
        self::assertTrue($service->ensureUploadDir($directory));
        $fileName = $service->buildFileName($videoId, $service->fetchTitle($videoId));

        try {
            self::assertTrue($service->downloadViaProviders($videoId, $fileName, $directory));
            $path = $directory . $fileName;
            self::assertFileExists($path);
            self::assertGreaterThan(1024, filesize($path));
        } finally {
            $path = $directory . $fileName;
            if (is_file($path)) unlink($path);
            if (is_dir($directory)) rmdir($directory);
        }
    }
}
