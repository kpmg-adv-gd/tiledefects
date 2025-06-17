sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "../BaseController",
    "../../utilities/CommonCallManager",
    "../../utilities/GenericDialog"
], function (JSONModel, BaseController, CommonCallManager, Dialog) {
    "use strict";

    return Dialog.extend("kpmg.custom.pod.GDPodCustom.GDPodCustom.controller.popup.ViewDefectPopup", {

        open: function (oView, oController, defect, defectStandard) {
            var that = this;
            that.ViewDefectModel = new JSONModel();
            that.MainPODcontroller = oController;
            that.defectSelected = defect;
            that.defectSelected.modifiedDateTime = defectStandard.modifiedDateTime;
            that.defectSelected.state = defectStandard.state;
            that.defectSelected.system_status_description = that.defectSelected.system_status_description == null ? "" : that.defectSelected.system_status_description.replaceAll(",", "\n");
            that.defectSelected.hasAttachment = defectStandard.fileIds && defectStandard.fileIds.length > 0

            if (that.defectSelected.hasAttachment) {
                that.defectSelected.files = defectStandard.fileIds;
            }

            that._initDialog("kpmg.custom.pod.GDPodCustom.GDPodCustom.view.popup.ViewDefectPopup", oView, that.ViewDefectModel);

            that.ViewDefectModel.setProperty("/wbe", that.defectSelected.wbe);
            that.ViewDefectModel.setProperty("/sfc", that.defectSelected.sfc);
            that.ViewDefectModel.setProperty("/wc", that.defectSelected.wc);
            that.ViewDefectModel.setProperty("/defect", that.defectSelected);
            that.ViewDefectModel.setProperty("/defect/attachments", []);

            var files = that.ViewDefectModel.getProperty("/defect/files");
            if (files) {
                files.forEach(element => {
                    that.downloadFile(element);
                });
            }
            that.openDialog();
            
        },

        downloadFile: function (idFile) {
            var that = this;

            let params = {
                fileId: idFile
            };

            var infoModel = that.MainPODcontroller.getInfoModel();
            let BaseProxyURL = infoModel.getProperty("/BaseProxyURL");
            let pathOrderBomApi = "/api/nonconformance/v1/file/download";
            let url = BaseProxyURL+pathOrderBomApi; 

            // Callback di successo
            var successCallback = function(response) {
                if (response.fileContent && response.contentType) {

                    that.ViewDefectModel.getProperty("/defect/attachments").push({
                        response: response,
                        FILE_NAME: response.fileName
                    });
                    that.ViewDefectModel.refresh();
                    
                } else {
                    that.showErrorMessageBox("No Content File");
                }
     
            };
            // Callback di errore
            var errorCallback = function(error) {
                console.log("Chiamata GET fallita:", error);
            };
            CommonCallManager.callProxy("POST", url, params, true, successCallback, errorCallback, that);
        },

        downloadAttachment: function (oEvent) {
            var that = this;
            var response = oEvent.getSource().getBindingContext().getObject().response;

            sap.ui.core.BusyIndicator.show(0);

            // Converte i dati in un Blob
            var uintArray = new Uint8Array(response.fileContent.data);
            var blob = new Blob([uintArray], { type: response.contentType });
            // Crea un URL per il file
            var fileUrl = URL.createObjectURL(blob);

            //Provo il Download
            var a = document.createElement("a");
            a.href = fileUrl;
            a.download = response.fileName; // Puoi settare il nome del file da scaricare
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            sap.ui.core.BusyIndicator.hide();
        },
        
        onAttachmentPress: function () {
            var that = this;
            var oDialog = that.getView().byId("uploadViewDialog");
            oDialog.open();
        },

        closePopupAttachments: function () {  
            var that = this;
            var oDialog = that.getView().byId("uploadViewDialog");
            oDialog.close();
        },

        formatDateTime: function(date) {
            var localeDate = new Date(date);
            var hh = localeDate.getHours();
            if (hh < 10) hh = '0' + hh;
            var mm = localeDate.getMinutes();
            if (mm < 10) mm = '0' + mm;
            var ss = localeDate.getSeconds();
            if (ss < 10) ss = '0' + ss;
            var day = localeDate.getDate();
            if (day < 10) day = '0' + day;
            var month = localeDate.getMonth() + 1;
            if (month < 10) month = '0' + month;
            var year = localeDate.getFullYear();
            if (year < 10) year = '0' + year;
            // Formato ISO 8601: dd/mm/yyyy HH:mm:ss
            return `${day}/${month}/${year} ${hh}:${mm}:${ss}`;
        },
        
        onClosePopup: function () {
            var that = this;
            that.closeDialog();
        }
    })
}
)