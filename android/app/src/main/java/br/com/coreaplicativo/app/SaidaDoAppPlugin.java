package br.com.coreaplicativo.app;

import android.app.ActivityManager;
import android.app.ApplicationExitInfo;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.List;

/**
 * POR QUE O APP MORREU DA ÚLTIMA VEZ (02/09).
 *
 * Autópsia de 28/08–02/09: 13–31% das tentativas de compra terminavam com o
 * app reiniciando 15–60s depois do toque, com a folha do Google na frente —
 * inclusive em Galaxy S25 e Z Flip, o que descarta "celular fraco". O banco
 * não tem como dizer POR QUÊ. O Android tem: desde o 11, ele guarda o motivo
 * de cada saída do processo (ApplicationExitInfo — memória baixa, crash,
 * ANR, usuário, freezer…). Este plugin só lê o último e entrega pro JS, que
 * cruza com a hora do toque em comprar e manda como evento.
 *
 * A morte do RENDERER do WebView (processo separado, que o sistema mata
 * primeiro quando a folha cobre o app) NÃO aparece no ExitInfo, porque o
 * processo principal sobrevive — a MainActivity grava esse caso nas
 * SharedPreferences, e este plugin devolve junto.
 */
@CapacitorPlugin(name = "SaidaDoApp")
public class SaidaDoAppPlugin extends Plugin {

    static final String PREFS = "core_saida";

    @PluginMethod
    public void ultimaSaida(PluginCall call) {
        JSObject r = new JSObject();
        SharedPreferences p = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        r.put("rendererMorreu", p.getBoolean("renderer_morreu", false));
        r.put("rendererQuando", p.getLong("renderer_quando", 0L));
        r.put("rendererCrash", p.getBoolean("renderer_crash", false));
        r.put("rendererPrioridade", p.getInt("renderer_prioridade", -1));
        r.put("disponivel", false);
        if (Build.VERSION.SDK_INT >= 30) {
            try {
                ActivityManager am = (ActivityManager) getContext().getSystemService(Context.ACTIVITY_SERVICE);
                // A lista mistura TODOS os processos do pacote — inclusive os
                // isolados do renderer ("isolated not needed", que saem a toda
                // hora). Só o processo PRINCIPAL diz por que o app morreu.
                List<ApplicationExitInfo> lista = am.getHistoricalProcessExitReasons(null, 0, 10);
                ApplicationExitInfo e = null;
                String principal = getContext().getPackageName();
                if (lista != null) {
                    for (ApplicationExitInfo x : lista) {
                        if (principal.equals(x.getProcessName())) { e = x; break; }
                    }
                }
                if (e != null) {
                    r.put("disponivel", true);
                    r.put("motivo", e.getReason());
                    r.put("descricao", e.getDescription() == null ? "" : e.getDescription());
                    r.put("quando", e.getTimestamp());
                    r.put("importancia", e.getImportance());
                    r.put("pss", e.getPss());
                }
            } catch (Exception ignored) {
                // sem permissão/quirk de fabricante: segue sem — nunca derruba o boot
            }
        }
        call.resolve(r);
    }
}
