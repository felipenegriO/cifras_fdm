<?php

class HelpCenterService
{
    public function all(): array
    {
        return [
            $this->article(
                'primeira-cifra',
                'Adicionar a primeira cifra',
                'Começando',
                'Cadastre uma música e deixe a primeira cifra pronta para a banda.',
                ['primeira cifra', 'música', 'cadastro', 'editor', 'começar'],
                ['home', 'editor'],
                ['Abra Músicas no menu e selecione Nova música.', 'Informe nome e artista.', 'Cole ou escreva a cifra no editor.', 'Revise o tom e salve.', 'Abra a música na Home para confirmar o resultado.'],
                ['Se o limite do plano for atingido, a aplicação informa antes de criar.', 'Conteúdo colado deve ser revisado no preview antes de salvar.'],
                ['importar-cifra', 'criar-repertorio']
            ),
            $this->article(
                'criar-repertorio',
                'Criar e organizar um repertório',
                'Repertórios',
                'Escolha músicas, defina a ordem e mantenha o repertório disponível para a banda.',
                ['repertório', 'setlist', 'playlist', 'ordem', 'músicas'],
                ['home', 'playlist', 'music'],
                ['Abra Repertórios.', 'Crie um repertório e informe nome e validade quando necessário.', 'Adicione as músicas disponíveis.', 'Organize a ordem.', 'Salve e abra novamente para confirmar a persistência.'],
                ['A validade controla quando o repertório aparece na Home.', 'Somente perfis autorizados podem editar.'],
                ['primeira-cifra', 'preparar-palco']
            ),
            $this->article(
                'categorias',
                'Como funcionam as categorias',
                'Começando',
                'Agrupe as músicas da banda pelo critério que fizer sentido para vocês.',
                ['categoria', 'classificação', 'organizar', 'filtro', 'agrupar'],
                ['home', 'editor', 'banda'],
                ['Abra Minha Banda e vá até a aba Categorias.', 'Use um dos conjuntos sugeridos ou escreva o nome da sua categoria.', 'No editor de cada música, escolha a categoria no campo Categoria.', 'Na tela inicial, toque no nome da categoria para ver só as músicas dela.'],
                ['O critério é da banda: momento do culto, estilo da música ou ocasião — o Cifrô não impõe nenhum.', 'Cada música fica em uma categoria por vez.', 'Somente gestores e administradores criam, renomeiam ou excluem categorias.', 'Uma categoria em uso por músicas não pode ser excluída.'],
                ['primeira-cifra', 'criar-repertorio']
            ),
            $this->article(
                'preparar-palco',
                'Preparar conteúdo para o palco',
                'Offline',
                'Sincronize cifras, repertórios e páginas antes de ficar sem conexão.',
                ['offline', 'palco', 'sincronizar', 'pacote', 'sem internet'],
                ['config', 'offline', 'playlist'],
                ['Conecte o dispositivo à internet.', 'Abra Configurações e selecione Sincronizar.', 'Aguarde a preparação de dados e páginas terminar.', 'Confirme que o status está pronto.', 'Ative o modo avião e teste a Home, o repertório e as cifras.'],
                ['Uma alteração posterior pode exigir nova preparação.', 'Uma falha de atualização mantém o último pacote válido.'],
                ['resolver-offline', 'criar-repertorio']
            ),
            $this->article(
                'modo-live',
                'Usar o Modo Live',
                'Apresentação',
                'Um líder controla a música e a rolagem enquanto os demais acompanham.',
                ['live', 'host', 'líder', 'seguidor', 'rolagem', 'ao vivo'],
                ['music', 'live'],
                ['Abra uma cifra e entre na aba Ao vivo.', 'Para acompanhar, selecione Entrar na sessão.', 'Para controlar, selecione Iniciar como líder quando seu perfil permitir.', 'Mantenha a cifra aberta durante a apresentação.', 'Ao terminar, saia da sessão ou feche a apresentação.'],
                ['Host é o dispositivo que publica o estado.', 'Quando o servidor ficar indisponível, a última cifra continua visível, mas a sincronização pausa.'],
                ['preparar-palco', 'resolver-offline']
            ),
            $this->article(
                'modo-ensaio',
                'Usar áudio, pitch e loop A/B',
                'Ensaio',
                'Estude um trecho com áudio local ou YouTube e repita partes difíceis.',
                ['ensaio', 'pitch', 'loop a/b', 'youtube', 'áudio', 'velocidade'],
                ['music', 'rehearsal'],
                ['Abra uma cifra e acesse Ferramentas.', 'Abra o painel de ensaio.', 'Escolha um vídeo ou arquivo de áudio.', 'Use pitch para ajustar o tom do áudio.', 'Marque A e B para repetir somente um trecho.', 'Remova o loop para voltar à reprodução completa.'],
                ['Pitch altera o áudio de estudo, não a cifra oficial.', 'A disponibilidade do YouTube depende do provedor externo.'],
                ['modo-live', 'primeira-cifra']
            ),
            $this->article(
                'resolver-offline',
                'Resolver problemas offline',
                'Offline',
                'Entenda por que uma cifra não abriu e recupere o pacote salvo.',
                ['offline', 'erro', 'cache', 'servidor indisponível', 'reconexão', 'snapshot'],
                ['config', 'offline', 'connectivity'],
                ['Confirme se o problema é internet ou servidor indisponível.', 'Abra Configurações e consulte o status offline.', 'Se estiver online, sincronize novamente.', 'Se houver versão anterior disponível, restaure somente quando a atual estiver inválida.', 'Evite resetar dados locais antes de tentar sincronizar.'],
                ['Resetar dados locais remove o pacote deste dispositivo.', 'A conta e os dados do servidor não são apagados pelo reset local.'],
                ['preparar-palco']
            ),
            $this->article(
                'convidar-integrante',
                'Convidar e gerenciar integrantes',
                'Conta e banda',
                'Adicione integrantes e escolha o nível de acesso adequado.',
                ['convite', 'integrante', 'usuário', 'perfil', 'permissão', 'externo'],
                ['users', 'band'],
                ['Abra Usuários.', 'Selecione Novo usuário ou importe uma conta existente.', 'Informe o perfil adequado.', 'Envie o convite.', 'Acompanhe a ativação e reenvie somente quando necessário.'],
                ['Administrador gerencia integrantes.', 'Gestor edita conteúdo; básico consulta e participa; externo possui acesso limitado.'],
                ['perfis-permissoes']
            ),
            $this->article(
                'importar-cifra',
                'Importar uma cifra com segurança',
                'Cifras',
                'Traga conteúdo autorizado, revise o resultado e confirme antes de salvar.',
                ['importar', 'colar cifra', 'arquivo', 'preview', 'link'],
                ['editor', 'import'],
                ['Abra o editor de música.', 'Escolha Importar cifra.', 'Cole o conteúdo autorizado.', 'Revise campos, acordes e seções no preview.', 'Confirme o direito de uso.', 'Salve somente depois de corrigir ambiguidades.'],
                ['A importação automática por URL depende de autorização do provedor.', 'O preview é obrigatório para evitar conteúdo incorreto ou perigoso.'],
                ['primeira-cifra']
            ),
            $this->article(
                'perfis-permissoes',
                'Entender perfis e permissões',
                'Conta e banda',
                'Escolha entre administrador, gestor, básico e externo sem conceder acesso excessivo.',
                ['administrador', 'gestor', 'básico', 'externo', 'permissão', 'perfil'],
                ['users', 'band', 'live'],
                ['Use administrador para gestão de integrantes.', 'Use gestor para edição de músicas, repertórios e roteiros.', 'Use básico para consulta, apresentação e acompanhamento.', 'Use externo para participação limitada.'],
                ['Ocultar um menu não substitui autorização no servidor.', 'O perfil é definido por banda.'],
                ['convidar-integrante', 'modo-live']
            ),
            $this->article(
                'privacidade-dados',
                'Exportar dados ou excluir a conta',
                'Conta e banda',
                'Baixe uma cópia dos seus dados ou solicite exclusão definitiva.',
                ['privacidade', 'exportar', 'excluir conta', 'dados', 'lgpd'],
                ['config', 'account'],
                ['Abra Configurações.', 'Na seção Conta, selecione Exportar meus dados para baixar uma cópia.', 'Para excluir, selecione Excluir conta e leia o impacto.', 'Confirme somente quando desejar a exclusão definitiva.'],
                ['Cancelar um plano não exclui seu conteúdo.', 'A exclusão da conta não pode ser desfeita pelo usuário.'],
                []
            ),
        ];
    }

    public function find(string $id): ?array
    {
        foreach ($this->all() as $article) {
            if ($article['id'] === $id) return $article;
        }
        return null;
    }

    public function categories(): array
    {
        $categories = [];
        foreach ($this->all() as $article) $categories[$article['category']] = true;
        return array_keys($categories);
    }

    public function glossary(): array
    {
        return [
            ['term' => 'BPM', 'definition' => 'Batidas por minuto; indica a velocidade musical.'],
            ['term' => 'Capo', 'definition' => 'Casa onde o capotraste deve ser colocado.'],
            ['term' => 'Host', 'definition' => 'Dispositivo líder que controla o estado do Modo Live.'],
            ['term' => 'Live', 'definition' => 'Apresentação sincronizada em que integrantes acompanham música e rolagem.'],
            ['term' => 'Loop A/B', 'definition' => 'Repetição contínua do trecho marcado entre os pontos A e B.'],
            ['term' => 'Pacote offline', 'definition' => 'Dados e páginas salvos no dispositivo para uso sem servidor.'],
            ['term' => 'Pitch', 'definition' => 'Ajuste do tom do áudio de ensaio sem mudar sua velocidade principal.'],
            ['term' => 'Repertório', 'definition' => 'Lista ordenada de músicas para ensaio ou apresentação.'],
            ['term' => 'Roteiro', 'definition' => 'Sequência de orientações, falas e conteúdos de uma atividade.'],
            ['term' => 'Sincronização', 'definition' => 'Atualização dos dados locais com a versão atual do servidor.'],
        ];
    }

    private function article(
        string $id,
        string $title,
        string $category,
        string $summary,
        array $keywords,
        array $contexts,
        array $steps,
        array $problems,
        array $related
    ): array {
        return compact('id', 'title', 'category', 'summary', 'keywords', 'contexts', 'steps', 'problems', 'related') + [
            'updated_at' => '2026-08-10',
            'offline' => true,
        ];
    }
}
