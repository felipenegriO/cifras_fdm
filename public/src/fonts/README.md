# Fontes FDM

Por padrão o app usa Google Fonts via CDN (cacheado no primeiro acesso online).
Para hospedar 100% local:

## Inter
Baixe em https://rsms.me/inter/download/ (zip > pasta `Inter Web/`) e copie estes 4 arquivos para `src/fonts/inter/`:

```
Inter-Regular.woff2
Inter-Medium.woff2
Inter-SemiBold.woff2
Inter-Bold.woff2
```

Ou via Google Fonts: https://fonts.google.com/specimen/Inter — baixe e converta para `.woff2` se vier `.ttf`.

## JetBrains Mono
Baixe em https://www.jetbrains.com/lp/mono/ (botão "Download font"), extraia e copie:

```
JetBrainsMono-Regular.woff2
JetBrainsMono-Medium.woff2
JetBrainsMono-Bold.woff2
```

Para `src/fonts/jetbrains/`.

Caso só venham arquivos `.ttf`, converta com https://www.fontsquirrel.com/tools/webfont-generator (configure como "Expert" e marque apenas WOFF2).

## Após copiar os arquivos
Edite `src/css/fonts.css`:
1. Comente a linha `@import url('https://fonts.googleapis.com/...')`.
2. Descomente o bloco "VIA LOCAL".

## Tamanhos esperados
- Inter completo (4 pesos, latin-ext): ~120KB
- JetBrains Mono (3 pesos, latin): ~80KB
- **Total: ~200KB bundlados** (vs. ~50KB no first paint via CDN, mas cacheado offline depois)
