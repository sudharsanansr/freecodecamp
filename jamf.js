var gR = new GlideRecord("x_snc_jamf_import_entry");
gR.query();
while(gR.next()){
    if(gR.getValue("response")){
        var response = JSON.parse(gR.getValue("response"));
        gs.print(response.computer.general.serial_number+" - "+response.computer.general.name);
    }
}