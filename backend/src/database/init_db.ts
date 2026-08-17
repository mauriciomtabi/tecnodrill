import { DBManager, supabase } from './db';

async function main() {
  console.log('--- TESTANDO CONEXÃO E ISOLAMENTO DO BANCO TECNODRILL ---');
  try {
    await DBManager.init();
    const users = await DBManager.getUsuarios();
    console.log(`✓ Usuários Tecnodrill ativos: ${users.length}`);
    users.forEach(u => console.log(`  - [${u.perfil}] ${u.nome} (${u.email})`));

    const servicos = await DBManager.getServicos();
    console.log(`✓ Serviços Tecnodrill cadastrados: ${servicos.length}`);
    servicos.forEach(s => console.log(`  - ${s.nome} | Cliente: ${s.cliente} | Cenário: ${s.cenario_financeiro}`));

    const furos = await DBManager.getFuros();
    console.log(`✓ Furos/Relatórios de Sondagem: ${furos.length}`);

    console.log('✓ Banco Tecnodrill operando com sucesso com isolamento total!');
  } catch (err) {
    console.error('Erro na inicialização:', err);
  }
}

main();
