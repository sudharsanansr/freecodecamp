(function(){

    var ciList = [];
    var ciGr = new GlideRecord('u_cmdb_ci_zoom_video_conference_unit');
    ciGr.addEncodedQuery('operational_status=1');
    ciGr.setLimit(15);
    ciGr.query();
    while(ciGr.next()){
        ciList.push(ciGr.getValue('name'));
    }


    for(var i = 0; i < 1; i++){
        var emGr = new GlideRecord('em_event');
        emGr.initialize();
        emGr.setValue('source','zoomtesting');
        emGr.setValue('node',ciList[Math.floor(Math.random() * ciList.length)]);
        emGr.setValue('message_key',makeid(12));
        emGr.setValue('type','zoom_room_monitoring_testing');
        emGr.setValue('resource','zoom_room_monitoring_testing');
        emGr.setValue('severity','3');
        emGr.setValue('description','Dummy alert for Zoom Room Noise');
        emGr.setValue('additional_info','{"issue":"this is the dumbest I can get","why":"no idea!"}');
        emGr.insert();
    }
    
})();


function makeid(length) {
    var result           = '';
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
       result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
 }