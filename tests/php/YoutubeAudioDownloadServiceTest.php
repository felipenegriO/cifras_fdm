<?php

use PHPUnit\Framework\TestCase;

final class YoutubeAudioDownloadServiceTest extends TestCase
{
    public function testIsValidVideoId(): void
    {
        $svc = new YoutubeAudioDownloadService();
        self::assertTrue($svc->isValidVideoId('dQw4w9WgXcQ'));
        self::assertFalse($svc->isValidVideoId(null));
        self::assertFalse($svc->isValidVideoId(''));
        self::assertFalse($svc->isValidVideoId('short'));
        self::assertFalse($svc->isValidVideoId('../../../etc/passwd'));
        self::assertFalse($svc->isValidVideoId('; rm -rf /12'));
    }

    public function testEnsureUploadDirWhenAlreadyExists(): void
    {
        $svc = new YoutubeAudioDownloadService([
            'isDir' => fn() => true,
            'mkdir' => fn() => self::fail('mkdir should not be called when dir exists'),
        ]);
        self::assertTrue($svc->ensureUploadDir('/some/dir/'));
    }

    public function testEnsureUploadDirCreatesWhenMissing(): void
    {
        $svc = new YoutubeAudioDownloadService([
            'isDir' => fn() => false,
            'mkdir' => fn($dir, $mode) => true,
        ]);
        self::assertTrue($svc->ensureUploadDir('/some/dir/'));
    }

    public function testEnsureUploadDirReturnsFalseOnMkdirFailure(): void
    {
        $svc = new YoutubeAudioDownloadService([
            'isDir' => fn() => false,
            'mkdir' => fn() => false,
        ]);
        self::assertFalse($svc->ensureUploadDir('/some/dir/'));
    }

    public function testBuildFileNameWithTitle(): void
    {
        $svc = new YoutubeAudioDownloadService();
        $name = $svc->buildFileName('dQw4w9WgXcQ', 'Rick Astley - Never Gonna Give You Up!');
        self::assertSame('yt_dQw4w9WgXcQ_Rick_Astley_-_Never_Gonna_Give_You_Up_.mp3', $name);
    }

    public function testBuildFileNameFallsBackWhenNoTitle(): void
    {
        $svc = new YoutubeAudioDownloadService();
        self::assertSame('yt_dQw4w9WgXcQ_audio_dQw4w9WgXcQ.mp3', $svc->buildFileName('dQw4w9WgXcQ', null));
        self::assertSame('yt_dQw4w9WgXcQ_audio_dQw4w9WgXcQ.mp3', $svc->buildFileName('dQw4w9WgXcQ', ''));
    }

    public function testFetchTitleReturnsNullWhenHttpFails(): void
    {
        $svc = new YoutubeAudioDownloadService(['httpGet' => fn() => false]);
        self::assertNull($svc->fetchTitle('dQw4w9WgXcQ'));
    }

    public function testFetchTitleReturnsNullWhenJsonHasNoTitle(): void
    {
        $svc = new YoutubeAudioDownloadService(['httpGet' => fn() => json_encode(['author' => 'x'])]);
        self::assertNull($svc->fetchTitle('dQw4w9WgXcQ'));
    }

    public function testFetchTitleReturnsTitle(): void
    {
        $svc = new YoutubeAudioDownloadService(['httpGet' => fn() => json_encode(['title' => 'Some Title'])]);
        self::assertSame('Some Title', $svc->fetchTitle('dQw4w9WgXcQ'));
    }

    public function testIsCachedFalseWhenFileMissing(): void
    {
        $svc = new YoutubeAudioDownloadService(['fileExists' => fn() => false]);
        self::assertFalse($svc->isCached('/tmp/x.mp3'));
    }

    public function testIsCachedFalseWhenFileTooSmall(): void
    {
        $svc = new YoutubeAudioDownloadService([
            'fileExists' => fn() => true,
            'fileSize' => fn() => 5000,
        ]);
        self::assertFalse($svc->isCached('/tmp/x.mp3'));
    }

    public function testIsCachedTrueWhenLargeEnough(): void
    {
        $svc = new YoutubeAudioDownloadService([
            'fileExists' => fn() => true,
            'fileSize' => fn() => 200000,
        ]);
        self::assertTrue($svc->isCached('/tmp/x.mp3'));
    }

    public function testSaveRemoteFileRejectsInvalidUrl(): void
    {
        $svc = new YoutubeAudioDownloadService();
        self::assertNull($svc->saveRemoteFile('not-a-url', 'x.mp3', '/tmp/'));
        self::assertNull($svc->saveRemoteFile(null, 'x.mp3', '/tmp/'));
    }

    public function testSaveRemoteFileRejectsWhenDownloadFails(): void
    {
        $svc = new YoutubeAudioDownloadService(['httpGet' => fn() => false]);
        self::assertNull($svc->saveRemoteFile('https://example.com/a.mp3', 'x.mp3', '/tmp/'));
    }

    public function testSaveRemoteFileRejectsWhenTooSmall(): void
    {
        $svc = new YoutubeAudioDownloadService(['httpGet' => fn() => 'tiny']);
        self::assertNull($svc->saveRemoteFile('https://example.com/a.mp3', 'x.mp3', '/tmp/'));
    }

    public function testSaveRemoteFileRejectsWhenWriteFails(): void
    {
        $svc = new YoutubeAudioDownloadService([
            'httpGet' => fn() => 'ID3' . str_repeat('a', 1500),
            'filePutContents' => fn() => false,
        ]);
        self::assertNull($svc->saveRemoteFile('https://example.com/a.mp3', 'x.mp3', '/tmp/'));
    }

    public function testSaveRemoteFileReturnsPathOnSuccess(): void
    {
        $svc = new YoutubeAudioDownloadService([
            'httpGet' => fn() => 'ID3' . str_repeat('a', 1500),
            'filePutContents' => fn() => 1500,
        ]);
        self::assertSame('/tmp/x.mp3', $svc->saveRemoteFile('https://example.com/a.mp3', 'x.mp3', '/tmp/'));
    }

    public function testDownloadViaProvidersSucceedsOnFirstProvider(): void
    {
        $calls = 0;
        $svc = new YoutubeAudioDownloadService([
            'httpGet' => function () use (&$calls) {
                $calls++;
                return $calls === 1
                    ? json_encode(['url' => 'https://cdn.example.com/a.mp3'])
                    : 'ID3' . str_repeat('a', 200000);
            },
            'filePutContents' => fn() => 200000,
            'fileSize' => fn() => 200000,
        ]);
        self::assertTrue($svc->downloadViaProviders('dQw4w9WgXcQ', 'x.mp3', '/tmp/'));
        self::assertSame(2, $calls);
    }

    public function testDownloadViaProvidersFallsBackToSecondProvider(): void
    {
        $calls = 0;
        $svc = new YoutubeAudioDownloadService([
            'httpGet' => function ($url) use (&$calls) {
                $calls++;
                // First provider's API call (call #1) returns no usable url;
                // second provider's API call (call #2) succeeds; the download
                // itself (call #3) returns file content.
                if ($calls === 1) {
                    return json_encode(['error' => 'nope']);
                }
                if ($calls === 2) {
                    return json_encode(['url' => 'https://cdn.example.com/a.mp3']);
                }
                return 'ID3' . str_repeat('a', 200000);
            },
            'filePutContents' => fn() => 200000,
            'fileSize' => fn() => 200000,
        ]);
        self::assertTrue($svc->downloadViaProviders('dQw4w9WgXcQ', 'x.mp3', '/tmp/'));
        self::assertSame(3, $calls);
    }

    public function testDownloadViaProvidersFailsWhenAllProvidersFail(): void
    {
        $svc = new YoutubeAudioDownloadService(['httpGet' => fn() => false]);
        self::assertFalse($svc->downloadViaProviders('dQw4w9WgXcQ', 'x.mp3', '/tmp/'));
    }

    public function testDownloadViaProvidersFailsWhenApiReturnsMalformedJson(): void
    {
        $svc = new YoutubeAudioDownloadService(['httpGet' => fn() => 'not json {']);
        self::assertFalse($svc->downloadViaProviders('dQw4w9WgXcQ', 'x.mp3', '/tmp/'));
    }

    public function testDownloadViaProvidersFailsWhenDownloadedFileTooSmall(): void
    {
        $svc = new YoutubeAudioDownloadService([
            'httpGet' => fn($url) => json_encode(['url' => 'https://cdn.example.com/a.mp3']),
            'filePutContents' => fn() => 100,
            'fileSize' => fn() => 100,
        ]);
        self::assertFalse($svc->downloadViaProviders('dQw4w9WgXcQ', 'x.mp3', '/tmp/'));
    }

    /** Exercises the real default closures (no injected deps) without touching the network. */
    public function testDefaultHttpGetUsesRealFileGetContents(): void
    {
        $svc = new YoutubeAudioDownloadService();
        $httpGet = self::readPrivateClosure($svc, 'httpGet');
        $result = $httpGet('data://text/plain,hello-world', 5);
        self::assertSame('hello-world', $result);
    }

    public function testDefaultHttpGetReturnsFalseOnUnreachableUrl(): void
    {
        $svc = new YoutubeAudioDownloadService();
        $httpGet = self::readPrivateClosure($svc, 'httpGet');
        $result = $httpGet('file:///path/does/not/exist/at/all.txt', 1);
        self::assertFalse($result);
    }

    public function testDefaultFilesystemDependenciesOperateOnRealDisk(): void
    {
        $svc = new YoutubeAudioDownloadService();
        self::assertSame('file_exists', self::readPrivateProp($svc, 'fileExists'));
        self::assertSame('filesize', self::readPrivateProp($svc, 'fileSize'));
        self::assertSame('is_dir', self::readPrivateProp($svc, 'isDir'));
        self::assertSame('file_put_contents', self::readPrivateProp($svc, 'filePutContents'));

        $dir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'cifro-yt-' . bin2hex(random_bytes(6)) . DIRECTORY_SEPARATOR;
        self::assertFalse(is_dir($dir));

        $mkdir = self::readPrivateClosure($svc, 'mkdir');
        self::assertTrue($mkdir($dir, 0755));
        self::assertTrue(is_dir($dir));

        rmdir($dir);
    }

    private static function readPrivateClosure(YoutubeAudioDownloadService $svc, string $prop): callable
    {
        return self::readPrivateProp($svc, $prop);
    }

    private static function readPrivateProp(YoutubeAudioDownloadService $svc, string $prop)
    {
        $ref = new ReflectionProperty(YoutubeAudioDownloadService::class, $prop);
        $ref->setAccessible(true);
        return $ref->getValue($svc);
    }
}
