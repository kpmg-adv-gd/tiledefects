sap.ui.define([
    'jquery.sap.global',
	"sap/ui/model/json/JSONModel",
    "./BaseController",
    "../utilities/CommonCallManager",
    "./popup/ViewDefectPopup",
    "sap/ui/export/Spreadsheet"
], function (jQuery, JSONModel, BaseController, CommonCallManager, ViewDefectPopup, Spreadsheet) {
	"use strict";

	return BaseController.extend("kpmg.custom.plugin.defectstile.defectstile.controller.MainView", {
        oDefectModel: new JSONModel(),
        oFilterModel: new JSONModel(),
        oDefectModelStandard: new JSONModel(),
        oGroupModel: new JSONModel(),
        ViewDefectPopup: new ViewDefectPopup(),
        oVarianceModel: new JSONModel(),
        tabSelection: null,

        onInit: function () {
			BaseController.prototype.onInit.apply(this, arguments);				           
            this.getView().setModel(this.oDefectModel, "DefectModel");		           
            this.getView().setModel(this.oDefectModelStandard, "DefectModelStandard");
            this.getView().setModel(this.oGroupModel, "GroupModel");
            this.getView().setModel(this.oVarianceModel, "VarianceModel");
            
            this.oFilterModel.setSizeLimit(10000);
            this.getView().setModel(this.oFilterModel,"FilterModel");

            this.oDefectModel.setProperty("/", []); 
            this.oDefectModelStandard.setProperty("/", []); 
            this.tabSelection = "approveQN"; 

            sap.ui.getCore().getEventBus().subscribe("defect", "reloadReportDefect", this.onReportGoPress, this);
            sap.ui.getCore().getEventBus().subscribe("defect", "cancelModify", this.cancelModify, this);

		},

        onAfterRendering: function(){
            var that = this;
            that.getVariance();
        },

        // Intercetta cambio di sezione
        changeTabSection: function (oEvent) {
            var that = this;
            // Pulizia modelli
            that.oDefectModel.setProperty("/", []);
            that.oDefectModel.setProperty("/filtered", []);
            that.oDefectModel.setProperty("/filteredReport", []);
            // Reset
            var sSelectedKey = oEvent.getParameter("selectedKey");
            if (sSelectedKey == "approveQN") {
                that.getDefectsToApprove();
                that.onReportClearPress();
                that.tabSelection = "approveQN"; 
            }else{
                that.onClearPress();
                that.setFilters();
                that.setFilterWBE();
                that.tabSelection = "reportDefect"; 
            }
        },

        setFilterWBE: function () {
            var that = this;
            let plant = that.getInfoModel().getProperty("/plant");
            
            let BaseProxyURL = that.getInfoModel().getProperty("/BaseProxyURL");
            let pathGetMarkingDataApi = "/db/getDefectsWBE";
            let url = BaseProxyURL + pathGetMarkingDataApi;

            let params = {
                plant: plant
            };

            // Callback di successo
            var successCallback = function (response) {
                var wbeList = [];
                response.forEach(item => {
                    wbeList.push({WBE: item.wbe})
                });
                that.oFilterModel.setProperty("/WBEs", wbeList);
            };
            // Callback di errore
            var errorCallback = function (error) {
                console.log("Chiamata POST fallita: ", error);
            };
            CommonCallManager.callProxy("POST", url, params, true, successCallback, errorCallback, that);
        },

        // Recupero CodeGroups 
        getCodeGroups: function () {
            var that = this;
            let plant = that.getInfoModel().getProperty("/plant");
            
            let BaseProxyURL = that.getInfoModel().getProperty("/BaseProxyURL");
            let pathGetMarkingDataApi = "/api/nonconformancegroup/v1/nonconformancegroups?plant=" + plant;
            let url = BaseProxyURL + pathGetMarkingDataApi;

            let params = {};

            // Callback di successo
            var successCallback = function (response) {
                response.groupResponse.forEach(item => item.associateCodes = []);
                if (response.groupResponse) {
                    this.oGroupModel.setProperty("/", response.groupResponse);
                }
                that.getCodes();
            };
            // Callback di errore
            var errorCallback = function (error) {
                console.log("Chiamata GET fallita: ", error);
            };
            CommonCallManager.callProxy("GET", url, params, true, successCallback, errorCallback, that);
        },
        // Recupero codes
        getCodes: function (oEvent) {
            var that = this;
            let plant = that.getInfoModel().getProperty("/plant");
            
            let BaseProxyURL =  that.getInfoModel().getProperty("/BaseProxyURL");
            let pathGetMarkingDataApi = "/api/nonconformancecode/v1/nonconformancecodes?plant=" + plant;
            let url = BaseProxyURL + pathGetMarkingDataApi;

            let params = {
            };

            // Callback di successo
            var successCallback = function (response) {
                if (response.codeResponse) {
                    response.codeResponse.forEach(code => {
                        code.groups.forEach(group => {
                            that.oGroupModel.getProperty("/").filter(item => item.group == group.group).forEach(item => item.associateCodes.push(code));
                        })
                    });
                    that.oGroupModel.refresh();
                    that.getDefectsToApprove();
                }
            };
            // Callback di errore
            var errorCallback = function (error) {
                console.log("Chiamata GET fallita: ", error);
            };
            CommonCallManager.callProxy("GET", url, params, true, successCallback, errorCallback, that);
        },
        // Recupero variances
        getVariance: function () {
            var that = this;
            var plant = that.getInfoModel().getProperty("/plant");

            let BaseProxyURL = that.getInfoModel().getProperty("/BaseProxyURL");
            let pathReasonForVarianceApi = "/db/getReasonsForVariance";
            let url = BaseProxyURL + pathReasonForVarianceApi;

            let params = {};

            // Callback di successo
            var successCallback = function (response) {
                that.oVarianceModel.setProperty("/", response.filter(item => item.plant == plant));
                that.getCodeGroups();
            };

            // Callback di errore
            var errorCallback = function (error) {
                console.log("Chiamata POST fallita: ", error);
            };
            CommonCallManager.callProxy("POST", url, params, true, successCallback, errorCallback, that);
        },


        // Prima sezione - approvazione QN

        // Salvare la riga selezionata (per approvare il QN)
        rowSelectionChange: function(oEvent){
            var that=this;
            var oTable = oEvent.getSource();
            var selectedIndex = oTable.getSelectedIndex();
            //Tutte le volte in cui ho selezionato (e non deselezionato)
            if( selectedIndex !== -1 ){
                var selectedObject = oTable.getContextByIndex(selectedIndex).getObject();
                that.getInfoModel().setProperty("/selectedDefect", selectedObject);
            } else {
                that.getInfoModel().setProperty("/selectedDefect",undefined);
            }
        },

        // Chiamata per ottenere i difetti da approvare
        getDefectsToApprove: function () {
            var that=this;
            let BaseProxyURL = that.getInfoModel().getProperty("/BaseProxyURL");
            let pathAPIFilter = "/db/selectDefectToApprove";
            let url = BaseProxyURL+pathAPIFilter;
            let plant = that.getInfoModel().getProperty("/plant");
            let params = {
                "plant": plant
            }
            // Callback di successo
            var successCallback = function(response) {
                that.oDefectModel.setProperty("/", response);
                that.oDefectModel.setProperty("/filtered", response);
                response.forEach(item => {
                    that.getDefectStandard(item.sfc, "/filtered");
                });
            };

            // Callback di errore
            var errorCallback = function(error) {
                console.log("Chiamata POST fallita:", error);
            };

            sap.ui.core.BusyIndicator.show(0);
            CommonCallManager.callProxy("POST", url, params, true, successCallback, errorCallback, that, true, true);
        },

        // Chiamata per ottenere lo standard dei difetti
        getDefectStandard: function(sfc, model) {
            var that=this;
            let plant = that.getInfoModel().getProperty("/plant");

            let BaseProxyURL = that.getInfoModel().getProperty("/BaseProxyURL");
            let pathAPIPodOperationTable = "/api/nonconformance/v2/nonconformances?plant=" + plant + "&sfc=" + sfc;
            let url = BaseProxyURL+pathAPIPodOperationTable;
            let params = {}

            // Callback di successo
            var successCallback = function(response) {
                var defectsStandard = response.defectResponse.content
                var defects = that.oDefectModel.getProperty("/");
                var defSTD = that.oDefectModelStandard.getProperty("/");
                that.oDefectModelStandard.setProperty("/", [...defSTD, ...defectsStandard]);
                defects.forEach(item => {
                    var defStd = defectsStandard.filter(elem => elem.id == item.id)
                    if (defStd.length > 0) {
                        defStd = defStd[0];
                        item.wc = defStd.workCenter;
                        item.numDefect = defStd.quantity;
                        item.varianceDesc = that.oVarianceModel.getProperty("/").filter(variance => variance.cause == item.variance)[0].description;
                        item.groupDesc = that.oGroupModel.getProperty("/").filter(group => group.group == item.group)[0].description;
                        item.codeDesc = that.oGroupModel.getProperty("/").filter(group => group.group == item.group)[0].associateCodes.filter(code => code.code == item.code)[0].description;
                        item.okClose = (!item.create_qn || (item.system_status != null && item.system_status.includes("ATCO")) || item.qn_annullata) && item.status == "OPEN";
                        item.hasAttachment = defStd.fileIds && defStd.fileIds.length > 0;
                        if (item.hasAttachment) {
                            item.files = defStd.fileIds;
                        }
                    }
                });
                that.oDefectModel.setProperty("/", defects);
                that.oDefectModel.setProperty(model, defects);
                that.oDefectModel.refresh();
                that.setFilters();
            };
            // Callback di errore
            var errorCallback = function(error) {
                console.log("Chiamata GET fallita:", error);
            };
            
            CommonCallManager.callProxy("GET", url, params, true, successCallback, errorCallback, that, true, true);
        },

        // Imposto i filtri in base ai dati presenti nella tabella
        setFilters: function () {
            var that = this;
            var defects = that.oDefectModel.getProperty("/");
            // Imposto i filtri in base a ciò che è presente in tabella
            var sfcs = [], wbes = [], orders= [], wcs = [], codeGroups = [], defectTypes = [], qnCodes = [], priorities= [], status = [];
            defects.forEach(item => {
                if (wbes.filter(elem => item.wbe == elem.WBE).length == 0) wbes.push({WBE: item.wbe})
                if (sfcs.filter(elem => item.sfc == elem.SFC).length == 0) sfcs.push({SFC: item.sfc})
                if (orders.filter(elem => item.mes_order == elem.ORDER).length == 0) orders.push({ORDER: item.mes_order})
                if (wcs.filter(elem => item.wc == elem.WORKCENTER).length == 0) wcs.push({WORKCENTER: item.wc})
                if (codeGroups.filter(elem => item.groupDesc == elem.CODEGROUP).length == 0) codeGroups.push({CODEGROUP: item.groupDesc})
                if (defectTypes.filter(elem => item.codeDesc == elem.DEFECTTYPE).length == 0) defectTypes.push({DEFECTTYPE: item.codeDesc})
                if (qnCodes.filter(elem => item.qn_code == elem.QN).length == 0) qnCodes.push({QN: item.qn_code})
                if (priorities.filter(elem => item.priority_description == elem.PRIORITY).length == 0) priorities.push({PRIORITY: item.priority_description})
                if (status.filter(elem => item.status == elem.STATUS).length == 0) status.push({STATUS: item.status})
            });
            that.oFilterModel.setProperty("/WBEs", wbes);
            that.oFilterModel.setProperty("/SFCs", sfcs);
            that.oFilterModel.setProperty("/ORDERs", orders);
            that.oFilterModel.setProperty("/WORKCENTERs", wcs);
            that.oFilterModel.setProperty("/CODEGROUPs", codeGroups);
            that.oFilterModel.setProperty("/DEFECTTYPEs", defectTypes);
            that.oFilterModel.setProperty("/QNs", qnCodes);
            that.oFilterModel.setProperty("/PRIORITYs", priorities);
            that.oFilterModel.setProperty("/STATUSs", status);
			that.oFilterModel.refresh();
        },

        // Pulizia dei campi di ricerca e rimozione dei filtri
        onClearPress: function(oEvent){
            var that = this;
            var oTable = that.getView().byId("defectTable");
            that.getView().byId("wbeInputId").setValue("");
            that.getView().byId("sfcInputId").setValue("");
            that.getView().byId("orderInputId").setValue("");
            that.getView().byId("wcInputId").setValue("");
            that.getView().byId("codeGroupInputId").setValue("");
            that.getView().byId("defectTypeInputId").setValue("");
            //Rimuovo filtri delle colonne della tabella
            const aColumns = oTable.getColumns();
			for (let i = 0; i < aColumns.length; i++) {
				oTable.filter(aColumns[i], null);
			}
        },

        // Filtraggio dei difetti in base ai campi di ricerca
        onGoPress: function () {
            var that = this;
            var defects = that.oDefectModel.getProperty("/");
            var defectsFiltered = defects;
            if (that.getView().byId("wbeInputId").getValue().length > 0)
                defectsFiltered = defectsFiltered.filter(item => item.wbe == that.getView().byId("wbeInputId").getValue())
            if (that.getView().byId("sfcInputId").getValue().length > 0)
                defectsFiltered = defectsFiltered.filter(item => item.sfc == that.getView().byId("sfcInputId").getValue())
            if (that.getView().byId("orderInputId").getValue().length > 0)
                defectsFiltered = defectsFiltered.filter(item => item.mes_order == that.getView().byId("orderInputId").getValue())
            if (that.getView().byId("wcInputId").getValue().length > 0)
                defectsFiltered = defectsFiltered.filter(item => item.wc == that.getView().byId("wcInputId").getValue())
            if (that.getView().byId("codeGroupInputId").getValue().length > 0)
                defectsFiltered = defectsFiltered.filter(item => item.groupDesc == that.getView().byId("codeGroupInputId").getValue())
            if (that.getView().byId("defectTypeInputId").getValue().length > 0)
                defectsFiltered = defectsFiltered.filter(item => item.codeDesc == that.getView().byId("defectTypeInputId").getValue())

            that.oDefectModel.setProperty("/filtered", defectsFiltered);
        },

        // Apertura del popup per visualizzare i dettagli del difetto
        onDetailsPress: function (oEvent) {
            var that = this;
            let defect = oEvent.getSource().getParent().getBindingContext("DefectModel").getObject();
            let path = oEvent.getSource().getParent().getBindingContext("DefectModel").getPath();
            that.oDefectModel.setProperty("/backupRowDefect", {
                defect: {
                    title: defect.title,
                    description: defect.description,
                    priority: defect.priority,
                    priority_description: defect.priority_description,
                    variance: defect.variance,
                    varianceDesc: defect.varianceDesc,
                    create_qn: defect.create_qn,
                    blocking: defect.blocking,
                    notification_type: defect.notification_type,
                    notification_type_description: defect.notification_type_description,
                    coding: defect.coding,
                    coding_description: defect.coding_description,
                    replaced_in_assembly: defect.replaced_in_assembly,
                    modelRadioReplaced: defect.modelRadioReplaced,
                    defect_note: defect.defect_note,
                    responsible: defect.responsible,
                },
                path: path
            });
            that.ViewDefectPopup.open(that.getView(), that, 
                defect, that.oDefectModelStandard.getProperty("/").filter(def => def.id == defect.id)[0], 
                that.tabSelection);
        },

        cancelModify: function () {
            var that = this;
            var backup = that.oDefectModel.getProperty("/backupRowDefect");
            var defect = that.oDefectModel.getProperty(backup.path);
            defect.title = backup.defect.title;
            defect.description = backup.defect.description;
            defect.priority = backup.defect.priority;
            defect.priority_description = backup.defect.priority_description;
            defect.variance = backup.defect.variance;
            defect.varianceDesc = backup.defect.varianceDesc;
            defect.create_qn = backup.defect.create_qn;
            defect.blocking = backup.defect.blocking;
            defect.notification_type = backup.defect.notification_type;
            defect.notification_type_description = backup.defect.notification_type_description;
            defect.coding = backup.defect.coding;
            defect.coding_description = backup.defect.coding_description;
            defect.replaced_in_assembly = backup.defect.replaced_in_assembly;
            defect.modelRadioReplaced = backup.defect.modelRadioReplaced;
            defect.defect_note = backup.defect.defect_note;
            defect.responsible = backup.defect.responsible;
            that.oDefectModel.refresh();
        },

        // Cancellazione del QN
        onCancelQN: function () {
            var that = this;
            if (that.getInfoModel().getProperty("/selectedDefect") == undefined) {
                that.showErrorMessageBox(that.getI18n("defects.errorMessage.noRowSelected"));
                return;
            }

            var that = this;
            let idDefect = that.getInfoModel().getProperty("/selectedDefect").id;

            let params = {
                defectId: idDefect,
                userId: that.getInfoModel().getProperty("/user_id")
            };

            let BaseProxyURL = that.getInfoModel().getProperty("/BaseProxyURL");
            let pathOrderBomApi = "/db/cancelDefectQN";
            let url = BaseProxyURL+pathOrderBomApi; 

            // Callback di successo
            var successCallback = function(response) {
                that.getDefectsToApprove();
                that.showToast(that.getI18n("defects.save.success.message"));
            };
            // Callback di errore
            var errorCallback = function(error) {
                console.log("Chiamata POST fallita:", error);
            };
            CommonCallManager.callProxy("POST", url, params, true, successCallback, errorCallback, that);

        },

        // Approvazione del QN
        onApproveQN: function () {
            var that = this;
            if (that.getInfoModel().getProperty("/selectedDefect") == undefined) {
                that.showErrorMessageBox(that.getI18n("defects.errorMessage.noRowSelected"));
                return;
            }

			var defect = that.getInfoModel().getProperty("/selectedDefect");
            let plant = that.getInfoModel().getProperty("/plant");
            let idDefect = defect.id;
            var wbeSplit = defect.wbe.split(".");
            var wbs = "";
            for (var i=0; i < wbeSplit.length - 1; i++) {
                if (wbs == "") {
                    wbs = wbeSplit[i];
                }else{
                    wbs = wbs + "." + wbeSplit[i];
                }
            }

            
            var poNumber = "";
            var prodOrder = "";
            if (defect.type_order == "GRPF") {
                poNumber = defect.mes_order;
            } else if (defect.type_order != "ZMGF") {
                prodOrder = defect.mes_order;
            }

            let dataForSap = {
                "notiftype": defect.notification_type,
                "shortText": defect.title,
                "priority": "" + defect.priority,
                "codeGroup": defect.coding_group,
                "code" : defect.coding,
                "material" : defect.material,
                "poNumber" : poNumber,
                "prodOrder" : prodOrder,
                "descript" : defect.defect_note,
                "dCodegrp" : defect.group,
                "dCode" : defect.sap_code,
                "assembly" : defect.assembly,
                "quantDefects" : "" + defect.numDefect,
                "partner" : defect.responsible,
                "textline" : defect.description,
                "wbeAssembly" : defect.wbe.replaceAll(" ", ""),         
                "zqmGrund" : defect.variance,
                "zqmInit" : defect.replaced_in_assembly ? "YES" : defect.replaced_in_assembly == false ? "NO" : "",
                "pspNr" : wbs.replaceAll(" ", ""),
                "zqmNplnr" : "",
                "zqmEqtyp" : "",
                "attach" : []                                      
            }

            let params = {
                dataForSap: dataForSap,
                defectId: idDefect,
                userId: that.getInfoModel().getProperty("/user_id"),
                plant: plant,
            };

            var files = defect.files;
            if (files) {
                that.downloadFile(dataForSap, files, 0, idDefect);
            }else{
                that.sendApproveQNToSAP(params)
            }      

        },

        sendApproveQNToSAP: function (params) {
            var that = this;

            let BaseProxyURL = that.getInfoModel().getProperty("/BaseProxyURL");
            let pathOrderBomApi = "/db/approveDefectQN";
            let url = BaseProxyURL+pathOrderBomApi; 
            
            // Callback di successo
            var successCallback = function(response) {
                that.getDefectsToApprove();
                sap.m.MessageBox.show(that.getI18n("defects.save.success.message"));    
            };
            // Callback di errore
            var errorCallback = function(error) {
                console.log("Chiamata POST fallita:", error);
            };
            CommonCallManager.callProxy("POST", url, params, true, successCallback, errorCallback, that, true, true);

        },

        downloadFile: function (dataForSap, files, i,  idDefect) {
            var that = this;
            let plant = that.getInfoModel().getProperty("/plant");

            if (files.length == i) {
                let params = {
                    dataForSap: dataForSap,
                    defectId: idDefect,
                    userId: that.getInfoModel().getProperty("/user_id"),
                    plant: plant
                };
                that.sendApproveQNToSAP(params);
                return;
            }

            let params = {
                fileId: files[i]
            };

            var infoModel = that.getInfoModel();
            let BaseProxyURL = infoModel.getProperty("/BaseProxyURL");
            let pathOrderBomApi = "/api/nonconformance/v1/file/download";
            let url = BaseProxyURL+pathOrderBomApi; 

            // Callback di successo
            var successCallback = function(response) {
                if (response.fileContent && response.contentType) {
                    dataForSap.attach.push({
                        "name": response.fileName,
                        "content": that.byteArrayToBase64(new Uint8Array(response.fileContent.data))
                    })
                }
                that.downloadFile(dataForSap, files, i+1, idDefect);
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

        // Seconda sezione - report difetti

        // Carico dati in tabella in base ai filtri
        onReportGoPress: function () {
            var that = this;
            var wbe = that.byId("reportWbeInputId").getValue();
            var creationDate = that.byId("reportCrDateInputId").getValue();
            var endDate = that.byId("reportEndDateInputId").getValue();

            if (!(wbe != "" || (creationDate != "" && endDate != ""))) {
                that.showErrorMessageBox(that.getI18n("defects.errorMessage.noFilterReport"));
                return;
            }

            that.getSFCbyFilter();
            
        },

        // Pulizia dei campi di ricerca e rimozione dei filtri
        onReportClearPress: function () {
            var that = this;
            var oTable = that.getView().byId("reportTableId");
            that.byId("reportWbeInputId").setValue("");
            that.byId("reportSfcInputId").setValue("");
            that.byId("reportOrderInputId").setValue("");
            that.byId("reportQnInputId").setValue("");
            that.byId("reportPriorityInputId").setValue("");
            that.byId("reportStatusInputId").setValue("");
            that.byId("reportCrDateInputId").setValue("");
            that.byId("reportEndDateInputId").setValue("");
            //Rimuovo filtri delle colonne della tabella
            const aColumns = oTable.getColumns();
			for (let i = 0; i < aColumns.length; i++) {
				oTable.filter(aColumns[i], null);
			}
        },

        // Chiamata per ottenere gli SFC in base ai filtri
        getSFCbyFilter: function () {
            var that=this;
            let BaseProxyURL = that.getInfoModel().getProperty("/BaseProxyURL");
            let pathAPIFilter = "/db/selectDefectForReport";
            let url = BaseProxyURL+pathAPIFilter;
            let plant = that.getInfoModel().getProperty("/plant");

            var creationDate = that.byId("reportCrDateInputId").getValue();
            var endDate = that.byId("reportEndDateInputId").getValue();
            var sfc = that.byId("reportSfcInputId").getValue();
            var order = that.byId("reportOrderInputId").getValue();
            var qnCode = that.byId("reportQnInputId").getValue();
            var priority = that.byId("reportPriorityInputId").getValue();
            var status = that.byId("reportStatusInputId").getValue();
            var wbe = that.byId("wbeInputId").getValue();

            let params = {
                "plant": plant,
                "wbe": wbe,
                "sfc": sfc,
                "order": order,
                "qnCode": qnCode,
                "priority": priority,
                "startDate": creationDate,
                "endDate": endDate,
                "status": status
            }
            // Callback di successo
            var successCallback = function(response) {
                that.oDefectModel.setProperty("/", response);
                that.oDefectModel.setProperty("/filteredReport", response);
                response.forEach(item => {
                    that.getDefectStandard(item.sfc, "/filteredReport");
                });
            };

            // Callback di errore
            var errorCallback = function(error) {
                console.log("Chiamata POST fallita:", error);
                sap.ui.core.BusyIndicator.hide();
            };
            
            sap.ui.core.BusyIndicator.show(0);
            CommonCallManager.callProxy("POST", url, params, true, successCallback, errorCallback, that);
        },
        onReportClosePress(oEvent) {
            var that = this;
            sap.m.MessageBox.show(
                that.getI18n("defect.warning.closeDefect"), // Messaggio da visualizzare
                {
                    icon: sap.m.MessageBox.Icon.WARNING, // Tipo di icona
                    title: that.getI18n("defect.titleWarning.closeDefect") || "Warning",         // Titolo della MessageBox
                    actions: [sap.m.MessageBox.Action.OK, sap.m.MessageBox.Action.CANCEL], 
                    onClose: function(oAction) {          // Callback all'interazione
                        if (oAction === "OK") {
                            that.onCloseDefect(oEvent) // Chiama il callback con il contesto corretto
                        }
                    }
                }
            );
        },
        // Chiusura del difetto
        onCloseDefect: function (oEvent) {
            var that = this;
            let defect = oEvent.getSource().getParent().getBindingContext("DefectModel").getObject();
            var plant = that.getInfoModel().getProperty("/plant");

            let params = {
                id: defect.id,
                plant: plant,
                comments: "",
                sfc: defect.sfc,
                order: defect.dm_order,
                qnCode: defect.qn_code == "" ? null : defect.qn_code
            };

            let BaseProxyURL = that.getInfoModel().getProperty("/BaseProxyURL");
            let pathOrderBomApi = "/api/nonconformance/v1/close";
            let url = BaseProxyURL+pathOrderBomApi; 

            // Callback di successo            defect, this.defectsStandard.getProperty("/").filter(def => def.id == defect.id)[0]            defect, this.defectsStandard.getProperty("/").filter(def => def.id == defect.id)[0]
            var successCallback = function(response) {
                that.onReportGoPress();
                that.showToast(that.getI18n("defect.close.success.message"));
            };
            // Callback di errore
            var errorCallback = function(error) {
                that.showErrorMessageBox(that.getI18n("defect.error.closeDefect"));
                console.log("Chiamata POST fallita:", error);
            };
            CommonCallManager.callProxy("POST", url, params, true, successCallback, errorCallback, that, true, true);
        },

        onExcelPress: function () {
            var that = this;
            var datasExcel = [];
            var reports = that.oDefectModel.getProperty("/filteredReport");

            if (reports && reports.length > 0) {
            
                sap.ui.core.BusyIndicator.show(0);

                reports.forEach(element => {
                    var selected = {
                        "WBE": element.wbe,
                        "SFC": element.sfc,
                        "MES ORDER": element.mes_order,
                        "MATERIAL": element.material,
                        "ASSEMBLY": element.assembly,
                        "QUANTITY": element.numDefect,
                        "CREATE QN": element.create_qn ? "YES" : "NO",
                        "QN CODE": element.qn_code,
                        "TITLE": element.title,
                        "DESCRIPTION": element.description,
                        "GROUP CODE": element.groupDesc,
                        "DEFECT TYPE": element.codeDesc,
                        "PRIORITY": element.priority_description,
                        "VARIANCE": element.varianceDesc,
                        "BLOCKING": element.blocking ? "YES" : "NO",
                        "NOTIFICATION TYPE": element.notification_type_description,
                        "CODING": element.coding_description,
                        "REPLACED IN ASSEMBLY": element.replaced_in_assembly ? "YES" : element.replaced_in_assembly == false ? "NO" : "",
                        "DEFECT NOTE": element.defect_note,
                        "RESPONSIBLE": element.responsible,
                        "USER": element.user,
                        "SYSTEM STATUS": element.system_status,
                        "USER STATUS": element.user_status,
                        "APPROVAL USER": element.approval_user,
                        "STATUS": element.status,
                        "CREATION DATE": that.formatDateTime(element.creation_date),
                        "END DATE": element.modifiedDateTime,
                    };
                    datasExcel.push(selected);
                });

                var aCols = this.createColumnExcel();
                var oSettings = {
                    workbook: {
                      columns: aCols
                    },
                    dataSource: datasExcel,
                    fileName: that.getNameFileExcel(),
                    worker: false // Imposta true per prestazioni migliori (ma richiede HTTPS)
                  };

                var oSpreadsheet = new Spreadsheet(oSettings);
                oSpreadsheet.build()
                  .then(function() {
                    sap.m.MessageToast.show("Download completed");
                    sap.ui.core.BusyIndicator.hide();
                  })
                  .catch(function(oError) {
                    console.error("Errore nell'esportazione:", oError);
                    sap.ui.core.BusyIndicator.hide();
                  });
            }else{
                that.showErrorMessageBox(that.getI18n("defects.errorMessage.noRowExcel"));
            }

        },
        getNameFileExcel: function () {
            const now = new Date();
            const yyyy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const dd = String(now.getDate()).padStart(2, '0');
            const hh = String(now.getHours()).padStart(2, '0');
            const min = String(now.getMinutes()).padStart(2, '0');
            const ss = String(now.getSeconds()).padStart(2, '0');

            return "Report_Defect_" + yyyy + "_" + mm + "_" + dd +  "_" + hh + "_" + min + "_" + ss + ".xlsx"
        },
        createColumnExcel: function() {
            return [
              {
                label: "WBE",
                property: "WBE",
                type: "string"
              },
              {
                label: "SFC",
                property: "SFC",
                type: "string"
              },
              {
                label: "MES ORDER",
                property: "MES ORDER",
                type: "string"
              },
              {
                label: "MATERIAL",
                property: "MATERIAL",
                type: "string"
              },
              {
                label: "ASSEMBLY",
                property: "ASSEMBLY",
                type: "string"
              },
              {
                label: "QUANTITY",
                property: "QUANTITY",
                type: "string"
              },
              {
                label: "CREATE QN",
                property: "CREATE QN",
                type: "string"
              },
              {
                label: "QN CODE",
                property: "QN CODE",
                type: "string"
              },
              {
                label: "TITLE",
                property: "TITLE",
                type: "string"
              },
              {
                label: "DESCRIPTION",
                property: "DESCRIPTION",
                type: "string"
              },
              {
                label: "GROUP CODE",
                property: "GROUP CODE",
                type: "string"
              },
              {
                label: "DEFECT TYPE",
                property: "DEFECT TYPE",
                type: "string"
              },
              {
                label: "PRIORITY",
                property: "PRIORITY",
                type: "string"
              },
              {
                label: "VARIANCE",
                property: "VARIANCE",
                type: "string"
              },
              {
                label: "BLOCKING",
                property: "BLOCKING",
                type: "string"
              },
              {
                label: "NOTIFICATION TYPE",
                property: "NOTIFICATION TYPE",
                type: "string"
              },
              {
                label: "CODING",
                property: "CODING",
                type: "string"
              },
              {
                label: "REPLACED IN ASSEMBLY",
                property: "REPLACED IN ASSEMBLY",
                type: "string"
              },
              {
                label: "DEFECT NOTE",
                property: "DEFECT NOTE",
                type: "string"
              },
              {
                label: "RESPONSIBLE",
                property: "RESPONSIBLE",
                type: "string"
              },
              {
                label: "USER",
                property: "USER",
                type: "string"
              },
              {
                label: "SYSTEM STATUS",
                property: "SYSTEM STATUS",
                type: "string"
              },
              {
                label: "USER STATUS",
                property: "USER STATUS",
                type: "string"
              },
              {
                label: "APPROVAL USER",
                property: "APPROVAL USER",
                type: "string"
              },
              {
                label: "STATUS",
                property: "STATUS",
                type: "string"
              },
              {
                label: "CREATION DATE",
                property: "CREATION DATE",
                type: "string"
              },
              {
                label: "END DATE",
                property: "END DATE",
                type: "string"
              }];
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

	});
});