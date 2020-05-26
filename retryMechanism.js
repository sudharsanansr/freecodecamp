import { identifier } from "@babel/types";

try {
    var scheduledJobName = 'Custom - Failed Sync Ticket Generator';

    var scopeId = new ITSRTCommonUtils().getRequestParams('LM_CMDB_Integration','lmScopeId')

    var ticketDetails = {};
    var ticketDescription = "      LogicMonitor CMDB Sync Failures Summary       \n" +
        "====================================================\n";

    var gr_syslog_app_scope = new GlideRecord('syslog_app_scope');

    // Application Scope of LogicMonitor CMDB Integration
    gr_syslog_app_scope.addEncodedQuery('sys_scope='+scopeId);
    gr_syslog_app_scope.addEncodedQuery('messageLIKERetry');
    gr_syslog_app_scope.addEncodedQuery('level=2');
    gr_syslog_app_scope.addEncodedQuery('sys_created_on>javascript:gs.endOfLastHour()');
    gr_syslog_app_scope.query();

    ticketDescription = ticketDescription + "TOTAL FAILED DEVICE SYNCS: $$TicketCount$$ " + "\n";
    
    var count = 0;
    while (gr_syslog_app_scope.next()) {
        var current = gr_syslog_app_scope;
        var ticketDescriptionEntry = "----------------------------------------------------------------------------------------\n" +
            "Sys Log ID: " + current.sys_id +
            "\n--------------------------------------------\n" +
            current.message + "\n";

        ticketDescription = ticketDescription + ticketDescriptionEntry;
        count++
    }

    if(count > 0){
        ticketDescription = ticketDescription.replace('$$TicketCount$$',count);

        var isTicketCreated = new global.LMServicenowAjaxUtil().generateEvent(ticketDescription);

        if (isTicketCreated != null || isTicketCreated != '') {
            // Expected return is a sys_id for created event if successfull or null/empty string
            gs.info("LogicMonitor CMDB App created event with " + /* gr_syslog_app_scope.getRowCount()*/ count + "failed Syncs sys_id of " + evtGr.sys_id);
        } else {
            gs.error("LogicMonitor CMDB App Failed to Create an Event for Failed Syncs");
        }
    }
    
    // Function below is defined in global scope to avoid Cross-Scope issues.
    // function generateEvent(ticketDescription) {
    //     var evtGr = new GlideRecord('em_event');
    //     evtGr.setValue('source', 'LogicMonitor Integration');
    //     evtGr.setValue('node', 'LogicMonitor');
    //     evtGr.setValue('resource', 'Integration failure events');
    //     evtGr.setValue('type', 'Sync failures');
    //     evtGr.setValue('severity', 3);
    //     evtGr.setValue('description', ticketDescription);
    //     evtGr.setValue('short_description', 'LogicMonitor CMDB Sync Failures');
    //     evtGr.insert();

    //     return evtGr.sys_id;
    // }
} catch (error) {
    gs.error(error.message); 
}