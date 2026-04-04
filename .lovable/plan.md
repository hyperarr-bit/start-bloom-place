

# Plano: Limpar Analytics + Melhorar Pet e Relações + Dream Journal

## 1. Analytics — manter só no ModuleDrawer

| Arquivo | Mudança |
|---------|---------|
| `src/App.tsx` | Remover import e renderização do `AdminFab` |
| `src/components/AdminFab.tsx` | Deletar arquivo |
| `src/components/home/GreetingHeader.tsx` | Remover botão BarChart3 e imports de `BarChart3`, `isAdmin`, `useAuth` |
| `src/pages/Index.tsx` | Remover botão BarChart3 e imports de `BarChart3`, `isAdmin`, `useAuth` |

Resultado: único ponto de acesso é o "Painel Analytics" no drawer de módulos da Home.

---

## 2. Pet — adicionar aba Diário

| Arquivo | Mudança |
|---------|---------|
| `src/components/pet/PetDiary.tsx` | **Novo.** Registro de momentos do pet: data, texto, emoji de humor. Cards com timeline vertical. Botão de adicionar entrada com campo de texto e seletor de pet |
| `src/pages/Pet.tsx` | Adicionar aba 📸 DIÁRIO (grid 5 colunas), importar `PetDiary` |

---

## 3. Relacionamentos — reformular com 5 abas

| Arquivo | Mudança |
|---------|---------|
| `src/components/relacionamentos/PeoplePanel.tsx` | Adicionar avatar visual com inicial + cor, mostrar countdown "X dias" para aniversário de forma mais proeminente com badge colorido |
| `src/components/relacionamentos/DateCalendar.tsx` | **Novo.** Dashboard visual de datas especiais: cards com foto/inicial da pessoa, nome do evento, countdown com cores (vermelho <7d, amarelo <30d, verde >30d). Eventos: aniversários (auto dos People), datas customizadas (Natal, casamento, etc) |
| `src/components/relacionamentos/GiftIdeas.tsx` | Adicionar campo "onde comprar / link" e lembrete automático: quando faltam <30 dias pro aniversário da pessoa, mostrar toast "Sua mãe disse que queria X, lembra?" |
| `src/components/relacionamentos/EventLog.tsx` | **Novo.** Log de eventos/convites: nome do evento, data, local/endereço, status RSVP (Confirmado/Talvez/Recusado), checklist de tarefas do evento |
| `src/pages/Relacionamentos.tsx` | Reorganizar para 5 abas: 💜 PESSOAS, 📅 AGENDA, ✨ MOMENTOS, 🎁 PRESENTES, 📋 EVENTOS |

---

## 4. Dream Journal — adicionar no módulo Mente

O módulo Mente (ex-Hiperfoco) é sobre captura de pensamentos e autoconhecimento — sonhos encaixam perfeitamente ali.

| Arquivo | Mudança |
|---------|---------|
| `src/components/hiperfoco/DreamJournal.tsx` | **Novo.** Registro de sonhos: data, descrição, tags de emoção (Medo, Alegria, Confuso, Lúcido, Pesadelo), campo "interpretação". Timeline com ícone 🌙. Filtro por tag |
| `src/pages/Hiperfoco.tsx` | Adicionar aba 🌙 SONHOS ao TabsList |

---

## Padrão técnico
- Todos os novos componentes usam `useUserData` com chaves específicas (`pet-diary`, `rel-dates`, `rel-events`, `mente-dreams`)
- Estilo consistente: `bg-card border border-border rounded-xl`, `AnimatePresence` + `motion.div`, formulários com `Input` + botão primary
- Emojis só nas abas, Lucide icons nos headers internos

