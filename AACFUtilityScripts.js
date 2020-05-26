(function(query){
    var alertGr = new GlideRecord('em_alert');
    alertGr.addEncodedQuery(query);
    alertGr.query();
    alertGr.deleteMultiple();
})('source=zoomtesting');