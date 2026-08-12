package br.com.coreaplicativo.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.ads.identifier.AdvertisingIdClient;

import java.util.concurrent.Executors;

/**
 * Ponte pro ID de publicidade do Android (GAID) — 12/08, decisão do dono.
 *
 * O SDK da Meta (ligado na MainActivity) já manda instalação e abertura com
 * o GAID sozinho. Este plugin existe pra COMPRA: ela fecha com o app fechado
 * (Pix pago horas depois), então quem manda o Purchase pra Meta é o servidor
 * (revenuecat-webhook/sync) — e o servidor só consegue anexar o madid se o
 * app tiver deixado o GAID gravado antes, na ficha app_device_info.
 *
 * Devolve gaid vazio quando: aparelho sem Play Services, usuário desativou
 * a personalização de anúncios (o Android devolve zeros — tratado aqui), ou
 * qualquer erro. Nunca rejeita: telemetria não derruba fluxo de venda.
 */
@CapacitorPlugin(name = "MetaAds")
public class MetaAdsPlugin extends Plugin {

    @PluginMethod
    public void idPublicidade(PluginCall call) {
        // getAdvertisingIdInfo bloqueia — proibido na main thread (lança).
        Executors.newSingleThreadExecutor().execute(() -> {
            JSObject ret = new JSObject();
            String gaid = "";
            try {
                AdvertisingIdClient.Info info =
                        AdvertisingIdClient.getAdvertisingIdInfo(getContext());
                if (info != null && !info.isLimitAdTrackingEnabled()) {
                    String id = info.getId();
                    // Opt-out vira "00000000-0000-0000-0000-000000000000":
                    // mandar isso pro CAPI só suja o pareamento.
                    if (id != null && !id.startsWith("00000000-")) gaid = id;
                }
            } catch (Exception | NoClassDefFoundError e) {
                // sem Play Services (emulador pelado) — segue vazio
            }
            ret.put("gaid", gaid);
            call.resolve(ret);
        });
    }
}
