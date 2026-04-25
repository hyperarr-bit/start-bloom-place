# Remover campos de Wi-Fi do módulo Casa

## Motivação
O usuário não quer armazenar dados sensíveis (senha de Wi-Fi) no app.

## Alteração
Arquivo: `src/components/casa/HomeUtilities.tsx`

1. Remover os states `wifiSSID` e `wifiPass` (linhas 11-12) e suas chaves no localStorage (`casa-wifi-ssid`, `casa-wifi-pass`).
2. Remover o bloco "QR Code do Wi-Fi" dentro da seção ANFITRIÃO (linhas 74-86), mantendo apenas o subbloco de Restrições Alimentares.
3. Limpar imports não usados: `Wifi` (lucide-react) e `QRCodeSVG` (qrcode.react). Também remover `Trash2` que já não é usado.
4. Como sobra só "Restrições Alimentares" na seção ANFITRIÃO, renomear o cabeçalho para `🍽️ ANFITRIÃO — RESTRIÇÕES DOS AMIGOS` e remover o subtítulo interno duplicado.

## Limpeza de dados antigos
Adicionar um efeito único no mount que faz `localStorage.removeItem("casa-wifi-ssid")` e `localStorage.removeItem("casa-wifi-pass")` para apagar qualquer senha que já tenha sido salva no dispositivo do usuário.

## Arquivo alterado
- `src/components/casa/HomeUtilities.tsx`
