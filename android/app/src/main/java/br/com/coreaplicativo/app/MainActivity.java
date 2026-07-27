package br.com.coreaplicativo.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugin local (não vem de npm): precisa ser registrado ANTES do
        // super.onCreate, senão a ponte sobe sem ele e a chamada do JS falha
        // com "not implemented".
        registerPlugin(CalendarioPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
