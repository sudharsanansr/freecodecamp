(function() {
    var adImpGr = new GlideRecord("u_asset_disposal_report");
    adImpGr.addEncodedQuery("u_shipment_id=897549");
	adImpGr.setLimit(5);
    adImpGr.query();	
    while (adImpGr.next()) {
        var almGr = new GlideRecord("alm_hardware");
        almGr.addEncodedQuery("serial_number=" + adImpGr.getValue("u_serial_number") + "^ORasset_tag=" + adImpGr.getValue("u_customer_tag"));
        almGr.query();
        if (almGr.next()) {
            //change state, substate, retired date
            //query asset disposal table with shipment id of disposal report and update the disposal certification on asset record
            gs.error("STRY1909670_AssetDisposal_SSR :: Asset found for the serial number/asset tag " + adImpGr.getValue("u_serial_number") + " - " + adImpGr.getValue("u_customer_tag"));
            almGr.setValue("install_status", 7); //Installstatus as Retired
            almGr.setValue("substatus", "disposed"); //Substatus as Disposed
            almGr.setValue("retired", new GlideDateTime(adImpGr.getValue("u_pick_up_date")).getDate());
            almGr.setValue("u_compliance",getDisposalCertificate(adImpGr.getValue("u_shipment_id")));
            almGr.update();
        } else {
            gs.error("STRY1909670_AssetDisposal_SSR :: Asset not found for the serial number/asset tag " + adImpGr.getValue("u_serial_number") + " - " + adImpGr.getValue("u_customer_tag"));
        }
    }
})();

function getDisposalCertificate(shipment_id){ //Check from u_compliance for the disposal certificate based on shipment id
    var cmpGr = new GlideRecord("u_compliance");
    cmpGr.addEncodedQuery("u_shipment_id="+shipment_id);
    cmpGr.query();
    if(cmpGr.next()){
        return cmpGr.getUniqueValue();
    }
    gs.error("STRY1909670_AssetDisposal_SSR :: Compliance record not found for the shipment id: "+shipment_id);
}