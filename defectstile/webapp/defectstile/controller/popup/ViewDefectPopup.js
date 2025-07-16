sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "../BaseController",
    "../../utilities/CommonCallManager",
    "../../utilities/GenericDialog"
], function (JSONModel, BaseController, CommonCallManager, Dialog) {
    "use strict";

    return Dialog.extend("kpmg.custom.plugin.defectstile.defectstile.controller.popup.ViewDefectPopup", {

        open: function (oView, oController, defect, defectStandard, tabSelection) {
            var that = this;
            that.ViewDefectModel = new JSONModel();
            that.MainPODcontroller = oController;
            that.defectSelected = defect;
            that.defectSelected.modifiedDateTime = defectStandard.modifiedDateTime;
            that.defectSelected.state = defectStandard.state;
            that.defectSelected.system_status_description = that.defectSelected.system_status_description == null ? "" : that.defectSelected.system_status_description.replaceAll(",", "\n");
            that.defectSelected.modelRadioReplaced = that.defectSelected.replaced_in_assembly ? 0 : 1;

            that._initDialog("kpmg.custom.plugin.defectstile.defectstile.view.popup.ViewDefectPopup", oView, that.ViewDefectModel);

            that.ViewDefectModel.setProperty("/wbe", that.defectSelected.wbe);
            that.ViewDefectModel.setProperty("/sfc", that.defectSelected.sfc);
            that.ViewDefectModel.setProperty("/wc", that.defectSelected.wc);
            that.ViewDefectModel.setProperty("/defect", that.defectSelected);
            that.ViewDefectModel.setProperty("/defect/attachments", []);
            that.ViewDefectModel.setProperty("/tabSelection", tabSelection);
            that.ViewDefectModel.setProperty("/modify", "off");

            if (defect.qn_annullata != true && defect.qn_approvata != true) {
                that.ViewDefectModel.setProperty("/notQN", "on");
            }else{
                that.ViewDefectModel.setProperty("/notQN", "off");
            }

            var files = that.ViewDefectModel.getProperty("/defect/files");
            if (files) {
                files.forEach(element => {
                    that.downloadFile(element);
                });
            }

            that.getPriority();
            that.getCoding();
            that.getNotificationType();
            that.getResponsible();
            that.getVariance();

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
                        FILE_NAME: response.fileName,
                        BASE_64: that.byteArrayToBase64(new Uint8Array(response.fileContent.data))
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

        byteArrayToBase64: function(byteArray) {
            // 1. Converti l'array di byte in una stringa binaria
            let binary = '';
            for (let i = 0; i < byteArray.length; i++) {
              binary += String.fromCharCode(byteArray[i]);
            }
          
            // 2. Codifica in base64 usando btoa
            return btoa(binary);
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

        onPressModify: function () {
            var that = this;
            that.ViewDefectModel.setProperty("/modify", "on");
        },

        validate: function () {
            var that = this;
            var defect = that.ViewDefectModel.getProperty("/defect");

            // Check sui campo obbligatori
            if (defect.numDefect == "" || defect.title == "" || defect.codeGroup == "" || defect.defectType == "" || defect.priority == "" 
                || defect.variance == "") {
                    that.MainPODcontroller.showErrorMessageBox(that.MainPODcontroller.getI18n("defect.error.message"));
                    return false;
                }
            if (defect.create_qn && (defect.coding == "" || (defect.modelRadioReplaced != 0 && defect.modelRadioReplaced != 1) || defect.responsible == "")) {
                that.MainPODcontroller.showErrorMessageBox(that.MainPODcontroller.getI18n("defect.error.message"));
                return false;
            }

            // Check su Costraint della Priority
            try {
                var priorityScript = JSON.parse(that.ViewDefectModel.getProperty("/priorities").filter(item => item.priority == defect.priority)[0].costraints);
                for (let chiave in priorityScript) {
                    for (let key in priorityScript[chiave]) {
                        if (priorityScript[chiave][key] && defect[key] == "") {
                            that.MainPODcontroller.showErrorMessageBox("Error Priority to field " + key);
                            return false;
                        }
                    }
                }
            } catch (e) {
                console.log("errore nel parsing json Priority");
            }
            // Check su Costraint della Notification Type
            if (defect.createQN) {
                try {
                    var notificationTypeScript = JSON.parse(that.ViewDefectModel.getProperty("/notificationTypies").filter(item => item.notification_type == defect.notificationType)[0].costraints);
                    for (let chiave in notificationTypeScript) {
                        for (let key in notificationTypeScript[chiave]) {
                            if (notificationTypeScript[chiave][key] && defect[key] == "") {
                                that.MainPODcontroller.showErrorMessageBox("Error Notification Type to field " + key);
                                return false;
                            }
                        }
                    }
                } catch (e) {
                    console.log("errore nel parsing json Notification Type");
                }
            }
            return true;
        },

        onSaveModifyPopup: function () {
            var that = this;
            var infoModel = that.MainPODcontroller.getInfoModel();
            var defect = that.ViewDefectModel.getProperty("/defect");

            if (!that.validate()) {
                return;
            }

            let params = {
                idDefect: defect.id,
                title: defect.title,
                description : defect.description,
                priority : defect.priority,
                variance: defect.variance,
                create_qn: defect.create_qn,
                blocking : defect.blocking,
                notificationType: defect.notification_type,
                coding: defect.coding,
                replaceInAssembly: defect.modelRadioReplaced == 0,
                defectNote: defect.defect_note,
                responsible: defect.responsible,
            }

            let BaseProxyURL = infoModel.getProperty("/BaseProxyURL");
            let pathSendMarkingApi = "/db/updateDefect";
            let url = BaseProxyURL + pathSendMarkingApi;

            // Callback di successo
            var successCallback = function (response) {
                that.MainPODcontroller.showToast("Defect modified.")
                sap.ui.getCore().getEventBus().publish("defect", "reloadReportDefect", null);
                that.onClosePopup();
            };

            // Callback di errore
            var errorCallback = function (error) {
                console.log("Chiamata POST fallita: ", error);
            };
            CommonCallManager.callProxy("POST", url, params, true, successCallback, errorCallback, that);
        },

        
        getPriority: function () {
            var that = this;

            var infoModel = that.MainPODcontroller.getInfoModel();
            let BaseProxyURL = infoModel.getProperty("/BaseProxyURL");
            let pathGetMarkingDataApi = "/db/getZPriorityData";
            let url = BaseProxyURL + pathGetMarkingDataApi;

            let params = { };

            // Callback di successo
            var successCallback = function (response) {
                this.ViewDefectModel.setProperty("/priorities", [...[{priority: "", description: ""}], ...response]);
            };
            // Callback di errore
            var errorCallback = function (error) {
                console.log("Chiamata POST fallita: ", error);
            };
            CommonCallManager.callProxy("POST", url, params, true, successCallback, errorCallback, that);
        },
        getVariance: function () {
            var that = this;
            var infoModel = that.MainPODcontroller.getInfoModel();
            var plant = infoModel.getProperty("/plant");

            let BaseProxyURL = infoModel.getProperty("/BaseProxyURL");
            let pathReasonForVarianceApi = "/db/getReasonsForVariance";
            let url = BaseProxyURL + pathReasonForVarianceApi;

            let params = {};

            // Callback di successo
            var successCallback = function (response) {
                this.ViewDefectModel.setProperty("/variances", [...[{cause: "", description: ""}], ...response.filter(item => item.plant == plant)]);
            };

            // Callback di errore
            var errorCallback = function (error) {
                console.log("Chiamata POST fallita: ", error);
            };
            CommonCallManager.callProxy("POST", url, params, true, successCallback, errorCallback, that);
        },
        getCoding: function () {
            var that = this;
            var infoModel = that.MainPODcontroller.getInfoModel();

            let BaseProxyURL = infoModel.getProperty("/BaseProxyURL");
            let pathReasonForVarianceApi = "/db/getZCodingData";
            let url = BaseProxyURL + pathReasonForVarianceApi;

            let params = {};

            // Callback di successo
            var successCallback = function (response) {
                this.ViewDefectModel.setProperty("/codings", [...[{coding: "", coding_description: ""}], ...response]);
            };

            // Callback di errore
            var errorCallback = function (error) {
                console.log("Chiamata POST fallita: ", error);
            };
            CommonCallManager.callProxy("POST", url, params, true, successCallback, errorCallback, that);
        },
        getResponsible: function () {
            var that = this;
            var infoModel = that.MainPODcontroller.getInfoModel();

            let BaseProxyURL = infoModel.getProperty("/BaseProxyURL");
            let pathReasonForVarianceApi = "/db/getZResponsibleData";
            let url = BaseProxyURL + pathReasonForVarianceApi;

            let params = {};

            // Callback di successo
            var successCallback = function (response) {
                this.ViewDefectModel.setProperty("/responsibles", [...[{id: ""}], ...response]);
            };

            // Callback di errore
            var errorCallback = function (error) {
                console.log("Chiamata POST fallita: ", error);
            };
            CommonCallManager.callProxy("POST", url, params, true, successCallback, errorCallback, that);
        },
        getNotificationType: function () {
            var that = this;
            var infoModel = that.MainPODcontroller.getInfoModel();

            let BaseProxyURL = infoModel.getProperty("/BaseProxyURL");
            let pathReasonForVarianceApi = "/db/getZNotificationTypeData";
            let url = BaseProxyURL + pathReasonForVarianceApi;

            let params = {};

            // Callback di successo
            var successCallback = function (response) {
                this.ViewDefectModel.setProperty("/notificationTypies", [...[{notification_type: "", description: ""}], ...response]);
            };

            // Callback di errore
            var errorCallback = function (error) {
                console.log("Chiamata POST fallita: ", error);
            };
            CommonCallManager.callProxy("POST", url, params, true, successCallback, errorCallback, that);
        },
        
        onCancelModify: function () {
            var that = this;
            sap.ui.getCore().getEventBus().publish("defect", "cancelModify", null);
            that.onClosePopup();
        },

        onClosePopup: function () {
            var that = this;
            that.closeDialog();
        }
    })
}
)