package br.com.coreaplicativo.app;

import android.content.Intent;
import android.provider.CalendarContract;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * "Adicionar ao calendário" (27/07, pedido de cliente: "como faço pra conectar
 * as consultas médicas e lembretes com o calendário do telefone").
 *
 * POR QUE ACTION_INSERT E NÃO SINCRONIZAÇÃO. Ler e escrever o calendário exige
 * as permissões READ_CALENDAR/WRITE_CALENDAR — permissões perigosas, que
 * aparecem na Data Safety da ficha, pedem diálogo ao usuário e trazem junto
 * todo o problema de sincronização de mão dupla (qual agenda? o que acontece
 * quando a pessoa edita dos dois lados? como não duplicar?).
 *
 * ACTION_INSERT não precisa de permissão NENHUMA: abre a tela de "novo evento"
 * do app de calendário que a pessoa já usa, com tudo preenchido, e QUEM GRAVA
 * é o app de calendário depois que ela confirma. É menos poder e mais respeito
 * — e é exatamente o que foi pedido: ver a consulta na agenda do telefone.
 *
 * Se um dia existir "sincronizar tudo automaticamente", aí sim vale a
 * permissão. Hoje seria pagar caro por um botão.
 */
@CapacitorPlugin(name = "Calendario")
public class CalendarioPlugin extends Plugin {

    @PluginMethod
    public void adicionarEvento(PluginCall call) {
        String titulo = call.getString("titulo", "");
        String local = call.getString("local", "");
        String descricao = call.getString("descricao", "");
        // milissegundos desde a época — o JS já resolve o fuso local
        long inicio = call.getLong("inicio", 0L);
        long fim = call.getLong("fim", 0L);

        if (titulo.isEmpty() || inicio <= 0) {
            call.reject("evento sem título ou sem data");
            return;
        }
        if (fim <= inicio) {
            fim = inicio + 3600000L; // 1h é a duração honesta de uma consulta
        }

        try {
            Intent intent = new Intent(Intent.ACTION_INSERT)
                .setData(CalendarContract.Events.CONTENT_URI)
                .putExtra(CalendarContract.Events.TITLE, titulo)
                .putExtra(CalendarContract.Events.EVENT_LOCATION, local)
                .putExtra(CalendarContract.Events.DESCRIPTION, descricao)
                .putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, inicio)
                .putExtra(CalendarContract.EXTRA_EVENT_END_TIME, fim)
                // sem isto o Android abre a tela do calendário DENTRO da nossa
                // pilha e o "voltar" fica confuso
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            // Tenta abrir e trata a ausência pela EXCEÇÃO, não por
            // resolveActivity: no Android 11+ o resolveActivity depende da
            // declaração <queries> no manifesto e devolve null por
            // invisibilidade, não por ausência — foi assim que este botão
            // dizia "sem app de calendário" num aparelho que tinha um.
            // A exceção é a verdade: ou abriu, ou não havia mesmo.
            getContext().startActivity(intent);
            call.resolve();
        } catch (android.content.ActivityNotFoundException e) {
            call.reject("sem app de calendário no aparelho", e);
        } catch (Exception e) {
            call.reject("não consegui abrir o calendário", e);
        }
    }
}
