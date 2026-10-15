# Correção do isolamento por autor — pronta para revisão

## Estado em 15/10/2026

Pacote preparado e testado localmente. Migração e Edge Function foram recusadas pela revisão automática de aprovação antes da execução. Não foram alterados dados, contas, políticas, bucket ou funções em produção e não foi feito push/deploy do frontend desta correção.

Projeto alvo: `dkscchjzztwyjzjpllob`, compartilhado com o JLE. Alterações restritas às cinco tabelas `tecnodrill_*`, novo schema privado `tecnodrill_private`, políticas do bucket `tecnodrill-fotos`, função de autenticação `tecnodrill-auth` e código do aplicativo Tecnodrill.

## Resultado pretendido

- Sessões reais do Supabase Auth, validadas no servidor. Importação da conta no primeiro login preserva UUID e hash bcrypt existente; não há senha mestra nem senha/hash no navegador.
- Operadores/navegadores: acesso apenas às barras cujo `registrado_por` coincide com o ID autenticado. Nomes iguais, metadados e perfil alterado no navegador não conferem acesso.
- Gestão: visão geral mantida. Administração de contas passa por função autenticada; desativar/remover acesso preserva os registros do autor.
- Fotos privadas com URLs temporárias, autorizadas por RLS. Mapeamento protegido das fotos antigas; novos uploads ficam no diretório do autor.
- Rotas antigas do backend passam a exigir JWT validado e perfil de gestão; consultas usam o JWT do solicitante, sem chave administrativa fixa.
- Fila offline separada por usuário. A fila antiga sem identificação fica preservada, sem sincronização automática em outra conta.

## Impactos previstos

Todos precisarão entrar novamente; a senha pessoal atual é preservada. As antigas senhas que funcionavam como desvio universal deixam de funcionar. Clientes antigos precisarão atualizar o aplicativo para carregar fotos após o bucket se tornar privado. A mudança de senha usa o Supabase Auth. Registros e contas existentes não são excluídos. Vínculos de equipe devem ter IDs; associações apenas por nome não concedem acesso.

## Ordem de aplicação após aprovação explícita

1. Conferir o diff e reaplicar os testes locais. Confirmar publicação correta em `tecnodrill-66l8` e preservar a versão anterior para diagnóstico.
2. Aplicar a migração `20261015180432_secure_tecnodrill_access.sql` e confirmar políticas/grants sem expor hashes ou dados individuais.
3. Publicar `tecnodrill-auth`. A verificação do gateway JWT fica desativada para permitir o login público; **todas as ações administrativas verificam o JWT e o perfil ativo no corpo da função**. Senhas são verificadas pelo Supabase Auth.
4. Fazer testes no banco e de autenticação, sem usar senhas de usuários reais. Publicar o frontend/backend e confirmar o build do commit correto.
5. Aplicar `activate-private-photos.sql` e verificar acesso permitido e negado ao bucket. Clientes da versão antiga precisarão atualizar.
6. Revogar a credencial administrativa exposta nas versões e no histórico anteriores, após coordenar os consumidores do JLE. Não basta apagar a chave do arquivo. Essa etapa exige identificar os consumidores compartilhados para não interromper outro sistema. A proteção **não pode ser considerada completa enquanto a chave antiga continuar utilizável**.

Não reverter para o frontend antigo após revogar a credencial, nem tornar as fotos públicas como solução de contingência. Em caso de falha, corrigir a nova autenticação preservando as restrições ou manter acesso temporariamente indisponível aos técnicos.

## Validação local

- 18 testes passaram: autorização da UI por ID, RLS real em Postgres isolado (PGlite), leitura/alteração/exclusão/autoria/fotos, perfil adulterado, usuário inativo, acesso anônimo, gestão, numeração e testes existentes de Terceiros.
- Build Vite aprovado; TypeScript do frontend e do backend sem erros.
- Novo build inspecionado: zero JWTs de `service_role` embutidos.
- Fluxo Edge testado com mocks: tokens ausentes/antigos recusados, operador não pode administrar contas, senha incorreta negada e nenhum hash retornado.

Os testes locais não substituem o teste do fluxo completo em produção após a autorização. A integração pode exigir ajustes de configuração do Auth e nova entrada dos usuários.
