<?php
interface ChordImportProvider
{
    public function import(string $url): array;
}
