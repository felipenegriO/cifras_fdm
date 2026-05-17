# Testes PHP (PHPUnit)

## Instalação

```bash
composer install
```

## Rodar

```bash
composer test
# ou
vendor/bin/phpunit
```

## Cobertura

```bash
vendor/bin/phpunit --coverage-text
```
Requer extensão Xdebug ou PCOV habilitada.

## Estrutura

- `ValidatorTest.php` — sanitização de strings/usernames.
- `UserRepositoryTest.php` — leitura de `usuarios.json`, lookup case-insensitive.
- `AuthServiceTest.php` — fluxo de login: senha errada, inativo, externo expirado/sem validade.

Os testes usam arquivos JSON temporários (`sys_get_temp_dir()`), não tocam dados reais.
