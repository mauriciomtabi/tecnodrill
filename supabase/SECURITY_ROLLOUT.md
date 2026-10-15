# Correção do isolamento por autor — acompanhamento da publicação

## Estado em 15/10/2026

Após aprovação explícita do usuário, a migração foi aplicada e a Edge Function `tecnodrill-auth` foi publicada. O frontend do commit `f677ea3` teve deploy confirmado com sucesso em `tecnodrill-66l8`. O bucket `tecnodrill-fotos` está privado e uma URL pública antiga foi verificada por HEAD, recebendo status 400. Um ajuste adicional revogou a permissão anônima herdada na função de primeiro acesso.

Foram preservados os 13 usuários e os 165 registros do Tecnodrill. As tabelas e políticas do JLE não foram alteradas. O banco continuou recebendo registros do JLE durante as verificações. Não houve criação das contas temporárias de teste: a revisão automática impediu os inserts e a validação foi feita com perfis reais dentro de transações desfeitas, além de testes locais e requisições HTTP inválidas/anônimas.

**Pendente:** validar um login real com o usuário e revogar a chave administrativa antiga de forma coordenada com o JLE. Nenhuma chave global, configuração de Auth ou configuração do JLE foi rotacionada. Enquanto a credencial antiga permanecer utilizável, a correção não representa isolamento completo contra acesso direto fora do aplicativo.

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

- 19 testes passaram: autorização da UI por ID, RLS real em Postgres isolado (PGlite), leitura/alteração/exclusão/autoria/fotos, perfil adulterado, usuário inativo, acesso anônimo, gestão, numeração, grants herdados e testes existentes de Terceiros.
- Build Vite aprovado; TypeScript do frontend e do backend sem erros.
- Novo build inspecionado: zero JWTs de `service_role` embutidos.
- Fluxo Edge testado com mocks: tokens ausentes/antigos recusados, operador não pode administrar contas, senha incorreta negada e nenhum hash retornado.

Em produção, as políticas foram testadas para todos os 13 perfis dentro de transações desfeitas, confirmando a visão própria dos técnicos e a visão de gestão. Também foram verificadas as permissões de fotos para os técnicos, o bloqueio anônimo da API e da função e o bloqueio de tokens antigos sem assinatura. O teste de login válido depende de um login real do usuário, sem compartilhamento de senha no chat.

A comparação dos vínculos legados por nome com os vínculos protegidos por ID não encontrou perda de acesso a obras. Duas contas de técnicos não têm obras atribuídas; elas já não correspondiam aos vínculos legados. Nenhum vínculo foi atribuído automaticamente por nome.

O projeto Vercel alternativo `tecnodrill` continua com falha de deploy pré-existente. Não foi confirmado se mantém rotas antigas publicadas; essa revisão depende de acesso aos logs/configuração desse projeto. A atualização confirmada é de `tecnodrill-66l8`.


## Correção de cadastro e gravações — 15/10/2026

- Cadastro retornava erro genérico para `operador.teste`, já existente desde agosto. A função v2 verifica login/e-mail antes de provisionar Auth e retorna conflito 409 compreensível; e-mail opcional vazio vira NULL.
- Obras e pagamentos deixam de retornar sucesso fictício quando a persistência falha. Removida a gravação duplicada de obra no backend legado. Falha do furo inicial é informada como gravação parcial, sem instruir novo cadastro da obra.
- Removida atualização de metragem pelo cliente após inserir registro: o trigger mantém o agregado de todos os autores.
- 26 testes locais passaram, incluindo criação administrativa com Auth simulado, duplicidade, gravação de obra/furo, falhas de persistência, pagamentos e isolamento. Teste RLS com unicidade de usuário/e-mail e número de barra.
- No banco real, sessão de gestão criou obra, furo, registro de 7 m e pagamento dentro de transação com ROLLBACK; agregado confirmado em 7 m e ausência de resíduos confirmada depois. Esse teste não substitui um cadastro/login completo via navegador.
- Nenhuma tabela ou configuração do JLE foi alterada.
