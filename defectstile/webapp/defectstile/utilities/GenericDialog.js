sap.ui.define([
    'jquery.sap.global',
    'sap/ui/base/Object'
], function (jQuery, Object) {
    "use strict";

    var GenericDialog = Object.extend("controller.GenericDialog", {
        _dialog: null,
        _view: null,
        _model: null,
        _isOpened: false,
        _initDialog: function (dialogClass, view, model) {
            // create dialog lazily
            if (null === this._dialog) {
                // create dialog via fragment factory
                this._dialog = sap.ui.xmlfragment(view.getId(), dialogClass, this);

            }
            // connect dialog to view (models, lifecycle)
            this._view = view;
            this._model = model;
            // this._infoModel = view.getModel("infoModel");
            // this._view.addDependent(this._dialog);
            // if(!!!!this._infoModel){
            //     this._dialog.setModel(this._infoModel,"infoModel");
            // }
            this._dialog.setModel(this._model);
            return this._dialog;
        },
        openDialog: function () {
            // open dialog
            this._dialog.open();
            this._isOpened = true;
        },
        closeDialog: function () {
            // close dialog
            this._dialog.close();
            this._isOpened = false;
        },
        getView: function () {
            return this._view;
        },
        getModel: function () {
            return this._model;
        },
        getDialog: function () {
            return this._dialog;
        },
        isOpened: function () {
            return this._isOpened;
        }
    });

    return GenericDialog;

});