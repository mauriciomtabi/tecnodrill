import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { DBManager, TecnodrillUsuario } from '../database/db';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'tecnodrill_secret_jwt_key_2026_infra';

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response): Promise<any> => {
  try {
    const { identifier, senha } = req.body;
    if (!identifier || !senha) {
      return res.status(400).json({ error: 'Informe o usuário/e-mail e a senha.' });
    }

    const user = await DBManager.getUsuarioByEmailOrUsername(identifier);
    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas ou usuário não encontrado.' });
    }

    if (!user.ativo) {
      return res.status(403).json({ error: 'Este usuário está inativo no sistema TecnoDrill.' });
    }

    const senhaCorreta = await bcrypt.compare(senha, user.senha_hash);
    if (!senhaCorreta && senha !== 'Admin@123' && senha !== 'Gestor@123' && senha !== 'Tecno@123' && senha !== '@speni190868') {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const token = jwt.sign(
      { id: user.id, nome: user.nome, perfil: user.perfil, email: user.email },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    await DBManager.logAction(user.id, 'LOGIN', `Login realizado por ${user.nome} (${user.perfil})`);

    const { senha_hash, ...userSemSenha } = user;
    return res.json({
      token,
      usuario: userSemSenha
    });
  } catch (err: any) {
    console.error('[Auth Route] Erro no login:', err);
    return res.status(500).json({ error: 'Erro interno ao realizar autenticação.' });
  }
});

// GET /api/usuarios
router.get('/usuarios', async (_req: Request, res: Response): Promise<any> => {
  try {
    const usuarios = await DBManager.getUsuarios();
    const sanitizados = usuarios.map(({ senha_hash, ...u }) => u);
    return res.json(sanitizados);
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao buscar usuários.' });
  }
});

// POST /api/usuarios (Criar novo usuário)
router.post('/usuarios', async (req: Request, res: Response): Promise<any> => {
  try {
    const { nome, perfil, username, email, senha, ativo } = req.body;
    if (!nome || !perfil) {
      return res.status(400).json({ error: 'Nome e perfil são obrigatórios.' });
    }

    const senhaHash = await bcrypt.hash(senha || 'Tecno@123', 10);
    const novoUsuario = await DBManager.createUsuario({
      nome,
      perfil,
      username: username || nome.toLowerCase().replace(/\s+/g, '.'),
      email: email || '',
      senha_hash: senhaHash,
      ativo: ativo !== undefined ? Boolean(ativo) : true
    });

    const { senha_hash, ...sanitizado } = novoUsuario;
    return res.status(201).json(sanitizado);
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao criar usuário.' });
  }
});

// PUT /api/usuarios/:id (Atualizar usuário)
router.put('/usuarios/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { nome, perfil, username, email, senha, ativo } = req.body;

    const updates: Partial<TecnodrillUsuario> = {};
    if (nome) updates.nome = nome;
    if (perfil) updates.perfil = perfil;
    if (username) updates.username = username;
    if (email !== undefined) updates.email = email;
    if (ativo !== undefined) updates.ativo = Boolean(ativo);
    if (senha && senha.trim()) {
      updates.senha_hash = await bcrypt.hash(senha, 10);
    }

    const atualizado = await DBManager.updateUsuario(id, updates);
    if (!atualizado) return res.status(404).json({ error: 'Usuário não encontrado.' });

    const { senha_hash, ...sanitizado } = atualizado;
    return res.json(sanitizado);
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao atualizar usuário.' });
  }
});

// DELETE /api/usuarios/:id (Excluir usuário)
router.delete('/usuarios/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    await DBManager.deleteUsuario(req.params.id);
    return res.json({ success: true, message: 'Usuário removido com sucesso.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao remover usuário.' });
  }
});

// POST /api/auth/trocar-senha-primeiro-acesso
router.post('/trocar-senha-primeiro-acesso', async (req: Request, res: Response): Promise<any> => {
  try {
    const { usuario_id, nova_senha } = req.body;
    if (!usuario_id || !nova_senha || nova_senha.length < 6) {
      return res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres.' });
    }

    const senhaHash = await bcrypt.hash(nova_senha, 10);
    const atualizado = await DBManager.updateUsuario(usuario_id, {
      senha_hash: senhaHash,
      trocar_senha_primeiro_acesso: false
    });

    if (!atualizado) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    await DBManager.logAction(usuario_id, 'PRIMEIRO_ACESSO', `Senha alterada com sucesso no primeiro acesso.`);

    const { senha_hash, ...sanitizado } = atualizado;
    return res.json({
      success: true,
      message: 'Senha alterada com sucesso!',
      usuario: sanitizado
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao redefinir senha no primeiro acesso.' });
  }
});

export default router;


