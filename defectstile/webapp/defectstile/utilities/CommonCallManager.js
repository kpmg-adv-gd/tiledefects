sap.ui.define([
    'jquery.sap.global',
    "sap/m/MessageBox"
], function(jQuery,MessageBox) {
    "use strict";
    
    var CommonCallManager = {
        callProxy: function(type, url, params, isAsync, successCallback, errorCallback, oContext, preventErrorMessageBox, showBusyLoading) {
            //let appKey=oContext.getInfoModel().getProperty("/appKey");
            // Controllo validità del tipo di richiesta
            if (type !== "GET" && type !== "POST") {
                // Richiama la callback di errore il tipo di chiamata non è supportato
                if (errorCallback && typeof errorCallback === "function") {
                    errorCallback({
                        status: 400,
                        message: "Invalid request type. Only 'GET' or 'POST' are supported."
                    });
                }
                return; // Termina l'esecuzione
            }

            if(showBusyLoading){
                sap.ui.core.BusyIndicator.show(0);
            }

            // Configura gli header
            var oHeaders = {
                'Content-Type': 'application/json',
                "Accept": "application/json"
                // 'x-app-key': appKey
            };

            // Configura la chiamata AJAX
            var settings = {
                type: type,
                url: url,
                async: isAsync,
                headers: oHeaders,
                success: function(response) {
                    if (successCallback) {
                        //.call permette di specificare il contesto con cui essere eseguita
                        successCallback.call(oContext || this, response);
                    }
                    sap.ui.core.BusyIndicator.hide();
                },
                error: function(error) {
                    // Recupera il messaggio di errore
                    var errorMessage = error?.responseJSON?.error?.message || error?.responseJSON?.error?.error?.message || error?.responseText || "An unknown error occurred.";         
                    try {
                        // Se è una stringa JSON (es. '"Errore test"') il parsing rimuove gli apici
                        errorMessage = JSON.parse(errorMessage);
                    } catch (e) {
                        // Se il parsing fallisce, rimuove eventuali apici esterni manualmente
                        errorMessage = errorMessage.replace(/^"(.*)"$/, '$1');
                    }
                    if (errorCallback) {
                        errorCallback.call(oContext || this, error?.responseJSON?.error);
                    }
                    if(!preventErrorMessageBox){
                        // Mostra il messaggio di errore come MessageBox
                        MessageBox.error(errorMessage, { 
                            title: "Error",
                            onClose: function() {
                            }
                        });
                    }
                    sap.ui.core.BusyIndicator.hide();
                }
            };

            if (type === "POST" && params) {
                settings.data = JSON.stringify(params); // Aggiungi i parametri per POST
            }


            // Esegui la chiamata
            jQuery.ajax(settings);


        }

    };

    return CommonCallManager;
});
