sap.ui.define([
	"sap/dm/dme/podfoundation/component/production/ProductionUIComponent",
	"sap/ui/Device"
], function (ProductionUIComponent, Device) {
	"use strict";

	return ProductionUIComponent.extend("kpmg.custom.plugin.defectstile.defectstile.Component", {
		metadata: {
			manifest: "json"
		}
	});
});