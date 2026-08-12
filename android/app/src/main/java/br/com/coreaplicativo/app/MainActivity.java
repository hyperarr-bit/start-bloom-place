package br.com.coreaplicativo.app;

import android.os.Bundle;

import com.facebook.FacebookSdk;
import com.facebook.LoggingBehavior;
import com.facebook.appevents.AppEventsLogger;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugins locais (não vêm de npm): precisam ser registrados ANTES do
        // super.onCreate, senão a ponte sobe sem eles e a chamada do JS falha
        // com "not implemented".
        registerPlugin(CalendarioPlugin.class);
        registerPlugin(MetaAdsPlugin.class);
        super.onCreate(savedInstanceState);

        // SDK da Meta (12/08, decisão do dono): é o que faz a campanha de App
        // Promotion enxergar instalação/abertura e otimizar. Só liga se o
        // client token existir — vazio, o SDK lança na primeira chamada Graph
        // e derrubaria o app (por isso AutoInitEnabled=false no manifest).
        String clientToken = getString(R.string.facebook_client_token);
        if (clientToken != null && !clientToken.isEmpty()) {
            // ORDEM IMPORTA (medida no emulador, 12/08): as três flags TÊM que
            // ser setadas ANTES do fullyInitialize. Sem isso o SDK sobe com
            // AdvertiserIDCollection indefinido — ele mesmo reclama no log — e
            // a instalação chegaria na Meta SEM o ID do aparelho, que é o
            // único jeito de ela casar a instalação com o clique no anúncio.
            // Era essa a razão de embarcar o SDK; nascer sem isso é o defeito
            // silencioso que anula a mudança inteira.
            // Só no APK de teste: cospe a requisição e a RESPOSTA da Meta no
            // logcat. Sem isto, "evento saiu" e "evento foi aceito" parecem
            // iguais — e a diferença entre os dois é a campanha inteira.
            // (FLAG_DEBUGGABLE em vez de BuildConfig: o AGP deste projeto não
            // gera a classe BuildConfig.)
            boolean debuggavel = (getApplicationInfo().flags
                    & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0;
            if (debuggavel) {
                FacebookSdk.setIsDebugEnabled(true);
                FacebookSdk.addLoggingBehavior(LoggingBehavior.APP_EVENTS);
                FacebookSdk.addLoggingBehavior(LoggingBehavior.REQUESTS);
            }
            // AdvertiserIDCollection PRIMEIRO: o primeiro setter chamado é o
            // que inicializa o UserSettingsManager, e se neste momento a
            // coleta do ID ainda estiver indefinida o SDK loga aviso (visto
            // no emulador com a ordem invertida).
            FacebookSdk.setAdvertiserIDCollectionEnabled(true);
            FacebookSdk.setAutoLogAppEventsEnabled(true);
            FacebookSdk.setAutoInitEnabled(true);
            FacebookSdk.fullyInitialize();
            // Instalação (fb_mobile_first_app_launch) + abertura
            // (fb_mobile_activate_app) automáticos a partir daqui.
            AppEventsLogger.activateApp(getApplication());
        }
    }
}
