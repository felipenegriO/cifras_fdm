<?php

use PHPUnit\Framework\TestCase;

final class HelpCenterServiceTest extends TestCase
{
    public function testCatalogoPossuiGuiasCompletosEReferenciasValidas(): void
    {
        $service = new HelpCenterService();
        $articles = $service->all();
        self::assertCount(11, $articles);

        $ids = array_column($articles, 'id');
        self::assertCount(count($ids), array_unique($ids));
        foreach ($articles as $article) {
            foreach (['id', 'title', 'category', 'summary', 'keywords', 'contexts', 'steps', 'problems', 'related', 'updated_at', 'offline'] as $field) {
                self::assertArrayHasKey($field, $article);
            }
            self::assertMatchesRegularExpression('/^[a-z0-9-]+$/', $article['id']);
            self::assertNotEmpty($article['steps']);
            self::assertNotEmpty($article['problems']);
            self::assertTrue($article['offline']);
            foreach ($article['related'] as $related) self::assertContains($related, $ids);
        }
        self::assertContains('categorias', $ids);

        self::assertSame($ids[0], $service->find($ids[0])['id']);
        self::assertNull($service->find('nao-existe'));
        self::assertNotEmpty($service->categories());
    }

    public function testGlossarioPossuiTermosUnicosEDefinidos(): void
    {
        $glossary = (new HelpCenterService())->glossary();
        self::assertCount(10, $glossary);
        $terms = array_column($glossary, 'term');
        self::assertCount(count($terms), array_unique($terms));
        foreach ($glossary as $item) {
            self::assertNotSame('', trim($item['term']));
            self::assertNotSame('', trim($item['definition']));
        }
    }
}
