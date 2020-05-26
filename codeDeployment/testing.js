(function(){
    var finalObj = {};
    var ciGr = new GlideRecord('cmdb_ci');
    ciGr.addEncodedQuery('x_snc_lm_snow_intg_event_attributes!=NULL');
    ciGr.query();
    while(ciGr.next()){
        if(typeof finalObj[ciGr.getValue('sys_class_name')] == 'undefined'){
            finalObj[ciGr.getValue('sys_class_name')] = [];
        }
        finalObj[ciGr.getValue('sys_class_name')].push(ciGr.getUniqueValue());
    }
    gs.print(JSON.stringify(finalObj,null,2));
})();