(function(){
    var tables = ['u_lm_payload_import','x_snc_lm_snow_intg_payload_processing_queue']
    tables.forEach(function(table){
        var dbGr = new GlideRecord(table);
        dbGr.deleteMultiple();
    })
})();