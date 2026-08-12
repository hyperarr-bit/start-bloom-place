package br.com.coreaplicativo.app;

import android.os.Bundle;

import com.facebook.FacebookSdk;
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
            FacebookSdk.setAutoInitEnabled(true);
            FacebookSdk.fullyInitialize();
            // Instalação (fb_mobile_first_app_launch) + abertura
            // (fb_mobile_activate_app) automáticos a partir daqui.
            AppEventsLogger.activateApp(getApplication());
        }
    }
}
